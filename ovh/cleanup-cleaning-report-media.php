<?php

declare(strict_types=1);

/**
 * Script OVH à copier dans /www/cron/cleanup-cleaning-report-media.php.
 * Il appelle la Edge Function Supabase cleanup-cleaning-report-media.
 * Objectif : supprimer les photos/documents des rapports ménage de plus de 7 jours,
 * tout en conservant les lignes de rapports dans staff_cleaning_reports.
 *
 * Ne jamais mettre les vraies clés dans GitHub : utiliser /www/cron/config.php sur OVH.
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
        CURLOPT_TIMEOUT => 120,
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

$supabaseUrl = rtrim(required_env('SUPABASE_URL'), '/');
$serviceRoleKey = required_env('SUPABASE_SERVICE_ROLE_KEY');
$retentionDays = (int) (getenv('CLEANING_REPORT_MEDIA_RETENTION_DAYS') ?: '7');
$dryRun = filter_var(getenv('CLEANING_REPORT_MEDIA_DRY_RUN') ?: 'false', FILTER_VALIDATE_BOOLEAN);

$result = request_json(
    'POST',
    $supabaseUrl . '/functions/v1/cleanup-cleaning-report-media',
    [
        'Authorization: Bearer ' . $serviceRoleKey,
    ],
    [
        'retentionDays' => $retentionDays,
        'dryRun' => $dryRun,
    ]
);

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

if (empty($result['ok'])) {
    exit(1);
}

exit(0);
