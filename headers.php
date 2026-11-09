<?php
function sendSecurityHeaders($csp)
{
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()');
    header('Content-Security-Policy: ' . $csp);
}

function guardApcu(string $op, array $args = [])
{
    return call_user_func_array('apcu_' . $op, $args);
}

function guardDeny(int $code, bool $json, int $retryAfter = 0): void
{
    http_response_code($code);
    if ($retryAfter > 0) {
        header('Retry-After: ' . $retryAfter);
    }
    header('Cache-Control: no-store, max-age=0');
    if ($json) {
        header('Content-Type: application/json; charset=UTF-8');
        echo '{"ok":false,"status":"error","message":"Слишком много запросов. Подождите немного."}';
    } else {
        header('Content-Type: text/plain; charset=UTF-8');
        echo $code === 429 ? 'Too Many Requests' : 'Forbidden';
    }
    exit;
}

function guardCountApcu(string $ipKey, string $bucket, int $windowSec, int $maxHits): int
{
    $banKey = 'ban:' . $ipKey;
    if (guardApcu('fetch', [$banKey])) {
        return PHP_INT_MAX;
    }
    $hitKey = 'rl:' . $bucket . ':' . $ipKey;
    $hits = guardApcu('fetch', [$hitKey]);
    if (is_int($hits)) {
        $inc = guardApcu('inc', [$hitKey, 1]);
        $hits = $inc === false ? $hits : (int) $inc;
    } else {
        guardApcu('store', [$hitKey, 1, $windowSec]);
        $hits = 1;
    }
    if ($hits > $maxHits * 2) {
        guardApcu('store', [$banKey, 1, 300]);
    }
    return $hits;
}

function guardCountFile(string $ipKey, string $bucket, int $windowSec, int $maxHits): int
{
    $shm = '/dev/shm';
    $dir = is_dir($shm) && is_writable($shm) ? $shm : sys_get_temp_dir();
    $file = $dir . '/optika_guard_' . $ipKey;
    $now = time();
    $state = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    $state = is_array($state) ? $state : ['ban' => 0, 'b' => []];
    if (($state['ban'] ?? 0) > $now) {
        return PHP_INT_MAX;
    }
    $slot = $state['b'][$bucket] ?? ['t' => $now, 'c' => 0];
    $count = ($now - ($slot['t'] ?? 0) >= $windowSec) ? 1 : (int) $slot['c'] + 1;
    $start = ($count === 1) ? $now : (int) $slot['t'];
    $state['b'][$bucket] = ['t' => $start, 'c' => $count];
    if ($count > $maxHits * 2) {
        $state['ban'] = $now + 300;
    }
    @file_put_contents($file, json_encode($state), LOCK_EX);
    return $count;
}

function guardRequest(string $bucket, int $maxHits, int $windowSec, bool $json = false, int $maxBody = 32768): void
{
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua !== '' && preg_match('/sqlmap|nikto|nmap|masscan|zgrab|nuclei|acunetix|gobuster|wfuzz|hydra|siege|wrk\/|vegeta|slowhttptest|goldeneye|loic|hoic|ddos/i', $ua)) {
        guardDeny(403, $json);
    }
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($maxBody > 0 && $len > $maxBody) {
        guardDeny(413, $json);
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ipKey = substr(hash('sha256', $ip . '|optika-guard'), 0, 20);
    $useApcu = function_exists('apcu_enabled') && (bool) guardApcu('enabled');
    $hits = $useApcu ? guardCountApcu($ipKey, $bucket, $windowSec, $maxHits) : guardCountFile($ipKey, $bucket, $windowSec, $maxHits);
    if ($hits > $maxHits) {
        guardDeny(429, $json, $hits === PHP_INT_MAX ? 300 : $windowSec);
    }
}
