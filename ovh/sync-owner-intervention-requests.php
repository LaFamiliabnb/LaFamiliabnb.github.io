<?php

declare(strict_types=1);

/**
 * Script OVH à copier dans /www/cron/sync-owner-intervention-requests.php.
 * Il lit les demandes propriétaire validées par l'admin dans Supabase puis crée les missions côté Nowistay.
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
        CURLOPT_TIMEOUT => 60,
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

function patch_request(string $supabaseUrl, array $headers, string $id, array $body): void
{
    request_json(
        'PATCH',
        $supabaseUrl . '/rest/v1/owner_intervention_requests?id=eq.' . rawurlencode($id),
        array_merge($headers, ['Prefer: return=minimal']),
        $body
    );
}

$nowistayBaseUrl = rtrim(getenv('NOWISTAY_API_BASE_URL') ?: 'https://api.nowistay.com', '/');
$nowistayCreateMissionEndpoint = getenv('NOWISTAY_CREATE_MISSION_ENDPOINT') ?: '/public/v1/missions';
$nowistayToken = required_env('NOWISTAY_API_TOKEN');
$supabaseUrl = rtrim(required_env('SUPABASE_URL'), '/');
$supabaseServiceRoleKey = required_env('SUPABASE_SERVICE_ROLE_KEY');

$nowistayHeaders = ['Authorization: Bearer ' . $nowistayToken];
$supabaseHeaders = [
    'apikey: ' . $supabaseServiceRoleKey,
    'Authorization: Bearer ' . $supabaseServiceRoleKey,
];

// On synchronise uniquement les demandes validées par l'admin, liées à un logement Nowistay.
// Les demandes refusées restent en "rejected". Les logements manuels restent internes.
$requests = request_json(
    'GET',
    $supabaseUrl . '/rest/v1/owner_intervention_requests?select=id,property_id,intervention_type,requested_for,time_window,title,description,urgency,nowistay_properties!inner(source)&status=eq.approved&nowistay_mission_id=is.null&nowistay_properties.source=eq.nowistay&order=created_at.asc&limit=25',
    $supabaseHeaders
);

$synced = 0;
$failed = 0;

foreach ($requests as $request) {
    try {
        $title = $request['title'] ?: (($request['intervention_type'] === 'maintenance') ? 'Maintenance demandée par le propriétaire' : 'Ménage demandé par le propriétaire');
        $descriptionParts = array_filter([
            $request['description'] ?? '',
            !empty($request['time_window']) ? 'Créneau préféré : ' . $request['time_window'] : '',
            !empty($request['urgency']) ? 'Urgence : ' . $request['urgency'] : '',
            'Source : espace propriétaire La Familia',
            'Validation admin : oui',
        ]);

        $payload = [
            'propertyId' => (int) $request['property_id'],
            'type' => $request['intervention_type'],
            'title' => $title,
            'description' => implode("\n", $descriptionParts),
            'scheduledAt' => $request['requested_for'],
        ];

        $created = request_json(
            'POST',
            $nowistayBaseUrl . $nowistayCreateMissionEndpoint,
            $nowistayHeaders,
            $payload
        );

        $missionId = $created['id'] ?? $created['missionId'] ?? ($created['data']['id'] ?? null);

        patch_request($supabaseUrl, $supabaseHeaders, $request['id'], [
            'status' => 'synced',
            'nowistay_mission_id' => $missionId ? (int) $missionId : null,
            'sync_error' => null,
        ]);

        $synced++;
    } catch (Throwable $exception) {
        $failed++;
        patch_request($supabaseUrl, $supabaseHeaders, $request['id'], [
            'status' => 'failed',
            'sync_error' => $exception->getMessage(),
        ]);
        error_log('[Owner intervention sync] Demande ignorée : ' . $exception->getMessage());
    }
}

echo json_encode([
    'ok' => $failed === 0,
    'synced' => $synced,
    'failed' => $failed,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
