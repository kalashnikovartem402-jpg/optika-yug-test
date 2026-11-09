<?php
declare(strict_types=1);

ini_set('display_errors', '0');

const SITE_ROOT = __DIR__ . '/..';
const DATA_DIR = __DIR__ . '/data';
const CONFIG_FILE = DATA_DIR . '/config.php';
const ATTEMPTS_FILE = DATA_DIR . '/attempts.php';
const SETUP_TOKEN_FILE = DATA_DIR . '/setup_token.php';
const BACKUP_DIR = DATA_DIR . '/backups';
const CONTENT_FILE = SITE_ROOT . '/content.json';
const UPLOADS_DIR = SITE_ROOT . '/uploads';

const MIN_PASSWORD_LENGTH = 10;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 900;
const SESSION_TTL = 7200;
const MAX_IMAGE_BYTES = 10485760;
const MAX_VIDEO_BYTES = 524288000;
const MAX_BACKUPS = 20;

const IMAGE_TYPES = ['jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'png' => ['image/png'], 'webp' => ['image/webp'], 'gif' => ['image/gif']];
const VIDEO_TYPES = ['mp4' => ['video/mp4', 'application/mp4'], 'm4v' => ['video/mp4', 'video/x-m4v'], 'webm' => ['video/webm'], 'mov' => ['video/quicktime']];

require_once __DIR__ . '/../headers.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');

guardRequest('admin_api', 45, 60, true, (($_GET['action'] ?? '') === 'upload') ? 0 : 262144);

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['ok' => false, 'error' => $message]);
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function ini_bytes(string $key): int
{
    $val = trim((string) ini_get($key));
    if ($val === '') return PHP_INT_MAX;
    $num = (int) $val;
    switch (strtolower(substr($val, -1))) {
        case 'g': return $num * 1073741824;
        case 'm': return $num * 1048576;
        case 'k': return $num * 1024;
    }
    return $num > 0 ? $num : PHP_INT_MAX;
}

function str_cut(string $s, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}

function load_config(): ?array
{
    if (!is_file(CONFIG_FILE)) return null;
    $cfg = include CONFIG_FILE;
    return is_array($cfg) && !empty($cfg['password_hash']) ? $cfg : null;
}

function write_php_array(string $file, array $data): void
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $code = "<?php\nreturn " . var_export($data, true) . ";\n";
    if (file_put_contents($tmp, $code, LOCK_EX) === false || !rename($tmp, $file)) {
        @unlink($tmp);
        fail(500, 'Не удалось записать конфигурацию. Проверьте права на папку admin/data.');
    }
    @chmod($file, 0600);
}

function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0700, true)) {
        fail(500, 'Не удалось создать папку admin/data.');
    }
}

function client_key(): string
{
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|optika');
}

function with_attempts(callable $fn)
{
    ensure_data_dir();
    $fh = fopen(ATTEMPTS_FILE, 'c+');
    if (!$fh) fail(500, 'Не удалось открыть журнал попыток входа.');
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $json = $raw ? substr($raw, (int) strpos($raw, "\n") + 1) : '';
    $data = json_decode($json ?: '[]', true);
    if (!is_array($data)) $data = [];
    $now = time();
    foreach ($data as $k => $row) {
        if (($row['until'] ?? 0) < $now && ($row['first'] ?? 0) < $now - LOCK_SECONDS) unset($data[$k]);
    }
    $result = $fn($data);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, "<?php exit; ?>\n" . json_encode($data));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

function locked_seconds(): int
{
    $key = client_key();
    return with_attempts(function (array &$data) use ($key) {
        $until = $data[$key]['until'] ?? 0;
        return max(0, $until - time());
    });
}

function register_failure(): void
{
    $key = client_key();
    with_attempts(function (array &$data) use ($key) {
        $now = time();
        $row = $data[$key] ?? ['count' => 0, 'first' => $now, 'until' => 0];
        $row['count']++;
        if ($row['count'] >= MAX_ATTEMPTS) {
            $row['until'] = $now + LOCK_SECONDS;
            $row['count'] = 0;
            $row['first'] = $now;
        }
        $data[$key] = $row;
    });
}

function clear_failures(): void
{
    $key = client_key();
    with_attempts(function (array &$data) use ($key) {
        unset($data[$key]);
    });
}

function clean_text($v, int $max): string
{
    if (!is_string($v)) $v = is_numeric($v) ? (string) $v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return str_cut(trim($v), $max);
}

function clean_asset($v): string
{
    $v = clean_text($v, 500);
    if ($v === '') return '';
    if (preg_match('#^https://#i', $v) && filter_var($v, FILTER_VALIDATE_URL)) return $v;
    if (preg_match('#^(images|uploads)/[A-Za-z0-9_\-./]+$#', $v) && strpos($v, '..') === false) return $v;
    return '';
}

function clean_link($v): string
{
    $v = clean_text($v, 500);
    return preg_match('#^(https?://|tel:|mailto:|\#)#i', $v) ? $v : '';
}

function clean_list($v, int $max, callable $fn): array
{
    if (!is_array($v)) return [];
    $out = [];
    foreach (array_slice(array_values($v), 0, $max) as $item) {
        if (is_array($item)) $out[] = $fn($item);
    }
    return $out;
}

function normalize_content($in): array
{
    if (!is_array($in)) fail(400, 'Некорректный формат данных.');
    $c = is_array($in['contacts'] ?? null) ? $in['contacts'] : [];
    $cat = is_array($in['catalog'] ?? null) ? $in['catalog'] : [];
    $srv = is_array($in['services'] ?? null) ? $in['services'] : [];
    $pl = is_array($in['playlist'] ?? null) ? $in['playlist'] : [];

    return [
        'contacts' => [
            'phoneMain' => clean_text($c['phoneMain'] ?? '', 40),
            'phoneMaster' => clean_text($c['phoneMaster'] ?? '', 40),
            'address' => clean_text($c['address'] ?? '', 200),
            'addressNote' => clean_text($c['addressNote'] ?? '', 200),
            'hours' => clean_text($c['hours'] ?? '', 200),
            'about' => clean_text($c['about'] ?? '', 600),
            'vkLink' => clean_link($c['vkLink'] ?? 'https://vk.me/opticasouth'),
            'maxLink' => clean_link($c['maxLink'] ?? 'https://max.ru/'),
        ],
        'catalog' => [
            'title' => clean_text($cat['title'] ?? '', 120),
            'subtitle' => clean_text($cat['subtitle'] ?? '', 300),
            'items' => clean_list($cat['items'] ?? [], 24, function (array $it) {
                return [
                    'title' => clean_text($it['title'] ?? '', 80),
                    'label' => clean_text($it['label'] ?? '', 40),
                    'image' => clean_asset($it['image'] ?? ''),
                    'link' => clean_link($it['link'] ?? ''),
                    'linkText' => clean_text($it['linkText'] ?? '', 60),
                ];
            }),
        ],
        'services' => [
            'title' => clean_text($srv['title'] ?? '', 120),
            'items' => clean_list($srv['items'] ?? [], 30, function (array $it) {
                $icon = clean_text($it['icon'] ?? '', 40);
                return [
                    'icon' => preg_match('/^[a-z0-9-]+$/', $icon) ? $icon : 'check',
                    'title' => clean_text($it['title'] ?? '', 120),
                    'text' => clean_text($it['text'] ?? '', 300),
                ];
            }),
        ],
        'playlist' => [
            'title' => clean_text($pl['title'] ?? '', 120),
            'author' => clean_text($pl['author'] ?? '', 120),
            'videos' => clean_list($pl['videos'] ?? [], 200, function (array $it) {
                $id = clean_text($it['id'] ?? '', 40);
                $dur = clean_text($it['duration'] ?? '', 10);
                return [
                    'id' => preg_match('/^[A-Za-z0-9_-]+$/', $id) ? $id : 'v' . bin2hex(random_bytes(4)),
                    'title' => clean_text($it['title'] ?? '', 160),
                    'subtitle' => clean_text($it['subtitle'] ?? '', 160),
                    'duration' => preg_match('/^\d{1,2}(:\d{2}){1,2}$/', $dur) ? $dur : '',
                    'thumb' => clean_asset($it['thumb'] ?? ''),
                    'src' => clean_asset($it['src'] ?? ''),
                ];
            }),
        ],
    ];
}

function detect_mime(string $path): string
{
    if (class_exists('finfo')) {
        return (string) (new finfo(FILEINFO_MIME_TYPE))->file($path);
    }
    $head = (string) file_get_contents($path, false, null, 0, 16);
    if (strncmp($head, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
    if (strncmp($head, "\x89PNG", 4) === 0) return 'image/png';
    if (strncmp($head, 'GIF8', 4) === 0) return 'image/gif';
    if (strncmp($head, 'RIFF', 4) === 0 && substr($head, 8, 4) === 'WEBP') return 'image/webp';
    if (strncmp($head, "\x1A\x45\xDF\xA3", 4) === 0) return 'video/webm';
    if (substr($head, 4, 4) === 'ftyp') return substr($head, 8, 4) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
    return 'application/octet-stream';
}

function backup_content(): void
{
    if (!is_file(CONTENT_FILE)) return;
    if (!is_dir(BACKUP_DIR)) @mkdir(BACKUP_DIR, 0700, true);
    @copy(CONTENT_FILE, BACKUP_DIR . '/content-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json');
    $files = glob(BACKUP_DIR . '/content-*.json') ?: [];
    sort($files);
    while (count($files) > MAX_BACKUPS) @unlink(array_shift($files));
}

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('optika_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/admin/api.php'), '/\\') . '/',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (!empty($_SESSION['auth']) && (time() - ($_SESSION['last'] ?? 0)) > SESSION_TTL) {
    $_SESSION = [];
    session_regenerate_id(true);
}
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

$authed = !empty($_SESSION['auth']);
if ($authed) $_SESSION['last'] = time();

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'status' && $method === 'GET') {
    respond(200, [
        'ok' => true,
        'backend' => 'php',
        'configured' => load_config() !== null,
        'setupOpen' => is_file(SETUP_TOKEN_FILE),
        'authed' => $authed,
        'csrf' => $_SESSION['csrf'],
        'https' => is_https(),
        'writable' => [
            'content' => is_writable(CONTENT_FILE) || (!is_file(CONTENT_FILE) && is_writable(SITE_ROOT)),
            'uploads' => is_dir(UPLOADS_DIR) ? is_writable(UPLOADS_DIR) : is_writable(SITE_ROOT),
            'data' => is_dir(DATA_DIR) ? is_writable(DATA_DIR) : is_writable(__DIR__),
        ],
        'maxUpload' => [
            'image' => min(MAX_IMAGE_BYTES, ini_bytes('upload_max_filesize'), ini_bytes('post_max_size')),
            'video' => min(MAX_VIDEO_BYTES, ini_bytes('upload_max_filesize'), ini_bytes('post_max_size')),
        ],
    ]);
}

if ($method !== 'POST') fail(405, 'Метод не поддерживается.');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    fail(403, 'Запрос с чужого домена отклонён.');
}
if (!hash_equals($_SESSION['csrf'], (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
    fail(403, 'Сессия устарела. Обновите страницу.');
}

$body = [];
if (strpos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === 0) {
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) fail(400, 'Некорректный JSON.');
}

switch ($action) {
    case 'setup':
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < MIN_PASSWORD_LENGTH) fail(400, 'Пароль должен быть не короче ' . MIN_PASSWORD_LENGTH . ' символов.');
        ensure_data_dir();
        $wait = locked_seconds();
        if ($wait > 0) fail(429, 'Слишком много неудачных попыток. Повторите через ' . ceil($wait / 60) . ' мин.');
        $expected = '';
        if (is_file(SETUP_TOKEN_FILE)) {
            $raw = (string) file_get_contents(SETUP_TOKEN_FILE);
            $expected = trim((string) substr($raw, (int) strpos($raw, "\n") + 1));
        }
        if ($expected === '') fail(403, 'Первичная настройка закрыта: создайте файл admin/data/setup_token.php на сервере.');
        if (!hash_equals($expected, trim((string) ($body['token'] ?? '')))) {
            register_failure();
            usleep(800000);
            fail(403, 'Неверный код установки.');
        }
        clear_failures();
        $fh = @fopen(CONFIG_FILE, 'x');
        if (!$fh) fail(403, 'Пароль уже установлен.');
        fclose($fh);
        write_php_array(CONFIG_FILE, ['password_hash' => password_hash($password, PASSWORD_DEFAULT), 'created' => date('c')]);
        @unlink(SETUP_TOKEN_FILE);
        session_regenerate_id(true);
        $_SESSION['auth'] = true;
        $_SESSION['last'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);

    case 'login':
        $cfg = load_config();
        if (!$cfg) fail(409, 'Пароль ещё не установлен.');
        $wait = locked_seconds();
        if ($wait > 0) fail(429, 'Слишком много неудачных попыток. Повторите через ' . ceil($wait / 60) . ' мин.');
        $password = (string) ($body['password'] ?? '');
        if (!password_verify($password, $cfg['password_hash'])) {
            register_failure();
            usleep(800000);
            fail(401, 'Неверный пароль.');
        }
        clear_failures();
        if (password_needs_rehash($cfg['password_hash'], PASSWORD_DEFAULT)) {
            $cfg['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            write_php_array(CONFIG_FILE, $cfg);
        }
        session_regenerate_id(true);
        $_SESSION['auth'] = true;
        $_SESSION['last'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);

    case 'logout':
        $_SESSION = [];
        session_regenerate_id(true);
        session_destroy();
        respond(200, ['ok' => true]);
}

if (!$authed) fail(401, 'Требуется вход в админ-панель.');

switch ($action) {
    case 'stats':
        require_once __DIR__ . '/stats_lib.php';
        respond(200, ['ok' => true, 'stats' => statsSnapshot()]);
        break;

    case 'save':
        $content = normalize_content($body['content'] ?? null);
        $json = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        backup_content();
        $tmp = CONTENT_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false || !rename($tmp, CONTENT_FILE)) {
            @unlink($tmp);
            fail(500, 'Не удалось сохранить content.json. Проверьте права на запись.');
        }
        respond(200, ['ok' => true, 'content' => $content]);

    case 'upload':
        $kind = (string) ($_POST['kind'] ?? '');
        $types = $kind === 'video' ? VIDEO_TYPES : ($kind === 'image' ? IMAGE_TYPES : null);
        if (!$types) fail(400, 'Неизвестный тип файла.');
        $file = $_FILES['file'] ?? null;
        if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $err = $file['error'] ?? UPLOAD_ERR_NO_FILE;
            fail(400, in_array($err, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'Файл слишком большой для настроек хостинга.'
                : 'Файл не был загружен.');
        }
        $limit = $kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if ($file['size'] > $limit) fail(400, 'Файл слишком большой (максимум ' . round($limit / 1048576) . ' МБ).');
        $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!isset($types[$ext])) fail(400, 'Недопустимый формат файла: .' . $ext);
        $mime = detect_mime($file['tmp_name']);
        if (!in_array($mime, $types[$ext], true)) fail(400, 'Содержимое файла не соответствует расширению.');
        if ($kind === 'image' && @getimagesize($file['tmp_name']) === false) fail(400, 'Файл не является изображением.');
        if (!is_dir(UPLOADS_DIR) && !@mkdir(UPLOADS_DIR, 0755, true)) fail(500, 'Не удалось создать папку uploads.');
        $name = $kind . '-' . date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], UPLOADS_DIR . '/' . $name)) fail(500, 'Не удалось сохранить файл.');
        @chmod(UPLOADS_DIR . '/' . $name, 0644);
        respond(200, ['ok' => true, 'path' => 'uploads/' . $name]);

    case 'password':
        $wait = locked_seconds();
        if ($wait > 0) fail(429, 'Слишком много неудачных попыток. Повторите через ' . ceil($wait / 60) . ' мин.');
        $cfg = load_config();
        if (!$cfg || !password_verify((string) ($body['current'] ?? ''), $cfg['password_hash'])) {
            register_failure();
            fail(401, 'Текущий пароль указан неверно.');
        }
        $new = (string) ($body['new'] ?? '');
        if (strlen($new) < MIN_PASSWORD_LENGTH) fail(400, 'Новый пароль должен быть не короче ' . MIN_PASSWORD_LENGTH . ' символов.');
        $cfg['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
        $cfg['changed'] = date('c');
        write_php_array(CONFIG_FILE, $cfg);
        session_regenerate_id(true);
        respond(200, ['ok' => true]);
}

fail(404, 'Неизвестное действие.');
