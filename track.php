<?php
declare(strict_types=1);

require_once __DIR__ . '/headers.php';
require_once __DIR__ . '/admin/stats_lib.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo '{"ok":false}';
    exit;
}

guardRequest('track', 10, 60, true, 2048);

$host = (string) parse_url('https://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    echo '{"ok":false}';
    exit;
}

$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$body = json_decode((string) file_get_contents('php://input', false, null, 0, 1024), true);
$body = is_array($body) ? $body : [];

if (statsIsBot($ua)) {
    echo '{"ok":true,"online":null}';
    exit;
}

$clean = function ($v, int $max): string {
    $v = is_string($v) ? preg_replace('/[\x00-\x1F\x7F]/u', '', $v) : '';
    return function_exists('mb_substr') ? mb_substr((string) $v, 0, $max, 'UTF-8') : substr((string) $v, 0, $max);
};
$path = $clean($body['path'] ?? '/', 120);
$refHost = parse_url($clean($body['ref'] ?? '', 300), PHP_URL_HOST);
$ref = is_string($refHost) && $refHost !== $host ? $clean($refHost, 80) : '';

$online = statsTrack($path, $ref, !empty($body['first']));
echo json_encode(['ok' => $online !== null, 'online' => $online]);
