<?php
require_once __DIR__ . '/headers.php';
guardRequest('page', 60, 60, false);
$uri = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') ?: '/';
if ($uri === '/admin') {
    header('Location: /admin/index.html', true, 302);
    exit;
}
if ($uri === '/privacy.html') {
    header('Location: /privacy', true, 301);
    exit;
}
if ($uri === '/privacy') {
    require_once __DIR__ . '/privacy.php';
    exit;
}
if ($uri === '/track.php' || $uri === '/track') {
    require_once __DIR__ . '/track.php';
    exit;
}
if ($uri !== '/') {
    header('Location: /', true, 301);
    exit;
}
header('Content-Type: text/html; charset=UTF-8');
sendSecurityHeaders("default-src 'self'; script-src 'self' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://mc.yandex.md wss://mc.yandex.ru wss://mc.yandex.com wss://mc.yandex.md; frame-src https://mc.yandex.ru https://mc.yandex.com https://yandexwebvisor.com; child-src blob:; worker-src blob:; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; frame-ancestors 'self';");
readfile(__DIR__ . '/index.html');
