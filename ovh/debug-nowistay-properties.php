<?php

declare(strict_types=1);

/**
 * Script de diagnostic OVH.
 * À copier dans /www/cron/debug-nowistay-properties.php.
 * Il liste les logements renvoyés par l'API Nowistay et cherche NWE / CONSTANTIN.
 * Ne contient aucune clé : il lit /www/cron/config.php.
 */

$configPath = __DIR__ . '/config.php';
if (is_file($configPath)) {
    $config = require $configPath;
    foreach ($config as $key => $value) {
        putenv($key . '=' . $value);
    }
}

function required_env(string $key): string
{
    $value = getenv($key);
    if ($value === false || trim($value) === '') {
        throw new RuntimeException('Variable manquante : ' . $key);
    }
    return trim($value);
}

function request_json(string $method, string $url, array $headers): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
        CURLOPT_TIMEOUT => 60,
    ]);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($response === false) {
        throw new RuntimeException('Erreur cURL : ' . $error);
    }

    $decoded = $response !== '' ? json_decode($response, true) : [];
    if (!is_array($decoded)) {
        $decoded = ['raw' => $response];
    }

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Erreur HTTP ' . $status . ' : ' . json_encode($decoded, JSON_UNESCAPED_UNICODE));
    }

    return $decoded;
}

function get_field(array $source, array $keys): ?string
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $source) && $source[$key] !== null && $source[$key] !== '') {
            return is_scalar($source[$key]) ? (string) $source[$key] : json_encode($source[$key], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
    return null;
}

function normalize_items(array $response): array
{
    foreach (['data', 'items', 'properties', 'results'] as $key) {
        if (isset($response[$key]) && is_array($response[$key])) {
            return $response[$key];
        }
    }
    return $response;
}

$nowistayBaseUrl = rtrim(getenv('NOWISTAY_API_BASE_URL') ?: 'https://api.nowistay.com', '/');
$nowistayToken = required_env('NOWISTAY_API_TOKEN');
$headers = ['Authorization: Bearer ' . $nowistayToken];

$limit = 100;
$total = 0;
$matches = [];

for ($offset = 0; $offset <= 1000; $offset += $limit) {
    $url = $nowistayBaseUrl . '/public/v1/properties?limit=' . $limit . '&offset=' . $offset;
    $response = request_json('GET', $url, $headers);
    $items = normalize_items($response);

    if (empty($items)) {
        echo "Offset {$offset}: 0 logement\n";
        break;
    }

    echo "Offset {$offset}: " . count($items) . " logement(s)\n";
    $total += count($items);

    foreach ($items as $property) {
        if (!is_array($property)) continue;

        $json = json_encode($property, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $name = get_field($property, ['name', 'title', 'displayName', 'internalName']) ?? '';

        if (stripos($json, 'NWE') !== false || stripos($json, 'CONSTANTIN') !== false || stripos($name, 'constantin') !== false) {
            $matches[] = [
                'id' => get_field($property, ['id', 'propertyId', 'property_id']),
                'name' => $name,
                'city' => get_field($property, ['city', 'town']),
                'ownerId' => get_field($property, ['ownerId', 'owner_id']),
                'raw' => $property,
            ];
        }
    }

    if (count($items) < $limit) {
        break;
    }
}

echo "\nTotal logements lus : {$total}\n";
echo "Correspondances NWE / CONSTANTIN : " . count($matches) . "\n\n";

echo json_encode($matches, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
