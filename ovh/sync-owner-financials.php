<?php

declare(strict_types=1);

/**
 * Script OVH à copier dans /www/cron/sync-owner-financials.php.
 * Il recalcule les finances propriétaires depuis la table Supabase nowistay_bookings.
 * À lancer après la synchronisation des réservations Nowistay.
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
    if ($body !== null) $finalHeaders[] = 'Content-Type: application/json';

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

    if ($response === false) throw new RuntimeException('Erreur cURL : ' . $error);

    $decoded = $response !== '' ? json_decode($response, true) : [];
    if (!is_array($decoded)) $decoded = ['raw' => $response];

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Erreur HTTP ' . $status . ' : ' . json_encode($decoded, JSON_UNESCAPED_UNICODE));
    }

    return $decoded;
}

function month_start(DateTimeImmutable $date): string
{
    return $date->modify('first day of this month')->format('Y-m-01');
}

$supabaseUrl = rtrim(required_env('SUPABASE_URL'), '/');
$supabaseServiceRoleKey = required_env('SUPABASE_SERVICE_ROLE_KEY');
$commissionRate = (float) (getenv('LAFAMILIA_OWNER_COMMISSION_RATE') ?: '0.20');
$monthsBack = max(0, (int) (getenv('OWNER_FINANCIAL_MONTHS_BACK') ?: '2'));
$monthsForward = max(0, (int) (getenv('OWNER_FINANCIAL_MONTHS_FORWARD') ?: '1'));

$supabaseHeaders = [
    'apikey: ' . $supabaseServiceRoleKey,
    'Authorization: Bearer ' . $supabaseServiceRoleKey,
];

$today = new DateTimeImmutable('today');
$results = [];
$totalRows = 0;

for ($offset = -$monthsBack; $offset <= $monthsForward; $offset++) {
    $month = month_start($today->modify(($offset >= 0 ? '+' : '') . $offset . ' month'));

    $result = request_json(
        'POST',
        $supabaseUrl . '/rest/v1/rpc/refresh_owner_financial_monthly',
        $supabaseHeaders,
        [
            'p_month_start' => $month,
            'p_commission_rate' => $commissionRate,
        ]
    );

    $rows = is_array($result) && array_key_exists(0, $result) ? (int) $result[0] : (int) $result;
    $results[] = [
        'month' => $month,
        'rows' => $rows,
    ];
    $totalRows += $rows;
}

echo json_encode([
    'ok' => true,
    'commissionRate' => $commissionRate,
    'monthsBack' => $monthsBack,
    'monthsForward' => $monthsForward,
    'rows' => $totalRows,
    'results' => $results,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
