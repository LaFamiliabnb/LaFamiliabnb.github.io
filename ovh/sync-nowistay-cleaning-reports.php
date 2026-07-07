<?php

declare(strict_types=1);

/**
 * Script OVH à copier dans /www/cron/sync-nowistay-cleaning-reports.php.
 * Ne pas mettre de vraies clés dans GitHub. Créer /www/cron/config.php sur OVH.
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

function request_json(string $method, string $url, array $headers, ?array $body = null): array
{
    $curl = curl_init($url);
    $finalHeaders = array_merge(['Accept: application/json'], $headers);

    if ($body !== null) {
        $finalHeaders[] = 'Content-Type: application/json';
    }

    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $finalHeaders,
        CURLOPT_TIMEOUT => 60,
    ]);

    if ($body !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

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

function array_get(array $source, array $keys, $default = null)
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $source) && $source[$key] !== null && $source[$key] !== '') {
            return $source[$key];
        }
    }
    return $default;
}

function normalize_photos($photos): array
{
    if (!is_array($photos)) return [];
    $result = [];
    foreach ($photos as $photo) {
        if (is_string($photo)) {
            $result[] = $photo;
        } elseif (is_array($photo)) {
            $url = array_get($photo, ['url', 'photoUrl', 'assetUrl', 'src']);
            if (is_string($url)) $result[] = $url;
        }
    }
    return array_values(array_unique(array_filter($result)));
}

function normalize_checklist($items): array
{
    if (!is_array($items)) return [];
    $result = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $label = array_get($item, ['label', 'name', 'title', 'task']);
        if (!is_string($label) || trim($label) === '') continue;
        $checked = array_get($item, ['checked', 'isChecked', 'done', 'completed'], false);
        $result[] = [
            'label' => trim($label),
            'checked' => filter_var($checked, FILTER_VALIDATE_BOOLEAN),
        ];
    }
    return $result;
}

$nowistayBaseUrl = rtrim(getenv('NOWISTAY_API_BASE_URL') ?: 'https://api.nowistay.com', '/');
$nowistayToken = required_env('NOWISTAY_API_TOKEN');
$supabaseUrl = rtrim(required_env('SUPABASE_URL'), '/');
$supabaseServiceRoleKey = required_env('SUPABASE_SERVICE_ROLE_KEY');

$nowistayHeaders = ['Authorization: Bearer ' . $nowistayToken];
$supabaseHeaders = [
    'apikey: ' . $supabaseServiceRoleKey,
    'Authorization: Bearer ' . $supabaseServiceRoleKey,
];

$missionsResponse = request_json(
    'GET',
    $nowistayBaseUrl . '/public/v1/missions?type=cleaning&status=completed',
    $nowistayHeaders
);

$missions = $missionsResponse['data'] ?? $missionsResponse['missions'] ?? $missionsResponse;
if (!is_array($missions)) {
    throw new RuntimeException('Réponse Nowistay inattendue.');
}

$inserted = 0;
$skipped = 0;
$errors = 0;

foreach ($missions as $mission) {
    if (!is_array($mission)) {
        $skipped++;
        continue;
    }

    try {
        $missionId = (int) array_get($mission, ['id', 'missionId'], 0);
        if ($missionId <= 0) {
            $skipped++;
            continue;
        }

        $existing = request_json(
            'GET',
            $supabaseUrl . '/rest/v1/cleaning_reports?select=id&nowistay_mission_id=eq.' . $missionId . '&limit=1',
            $supabaseHeaders
        );

        if (!empty($existing)) {
            $skipped++;
            continue;
        }

        $detail = request_json(
            'GET',
            $nowistayBaseUrl . '/public/v1/missions/' . $missionId,
            $nowistayHeaders
        );

        $propertyId = (int) array_get($detail, ['propertyId', 'property_id', 'accommodationId'], (int) array_get($mission, ['propertyId', 'property_id'], 0));
        if ($propertyId <= 0) {
            $skipped++;
            continue;
        }

        $properties = request_json(
            'GET',
            $supabaseUrl . '/rest/v1/properties?select=id&nowistay_property_id=eq.' . $propertyId . '&limit=1',
            $supabaseHeaders
        );

        if (empty($properties[0]['id'])) {
            $skipped++;
            continue;
        }

        request_json(
            'POST',
            $supabaseUrl . '/rest/v1/cleaning_reports',
            array_merge($supabaseHeaders, ['Prefer: return=minimal']),
            [
                'nowistay_mission_id' => $missionId,
                'nowistay_property_id' => $propertyId,
                'property_id' => $properties[0]['id'],
                'cleaner_name' => array_get($detail, ['cleanerName'], array_get($mission, ['cleanerName'])),
                'guest_name' => array_get($detail, ['guestName'], array_get($mission, ['guestName'])),
                'completed_at' => array_get($detail, ['completedAt', 'completed_at', 'finishedAt'], array_get($mission, ['completedAt', 'completed_at'])),
                'comment' => array_get($detail, ['comment', 'comments', 'note'], ''),
                'photos' => normalize_photos(array_get($detail, ['photos'], [])),
                'checklist' => normalize_checklist(array_get($detail, ['checklist', 'tasks'], [])),
            ]
        );

        $inserted++;
    } catch (Throwable $exception) {
        $errors++;
        error_log('[Nowistay sync] Mission ignorée : ' . $exception->getMessage());
    }
}

echo json_encode([
    'ok' => $errors === 0,
    'inserted' => $inserted,
    'skipped' => $skipped,
    'errors' => $errors,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
