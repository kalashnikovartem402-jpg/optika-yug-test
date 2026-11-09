<?php
declare(strict_types=1);

const STATS_ONLINE_TTL = 75;
const STATS_DAYS_KEEP = 90;
const STATS_VISITS_KEEP = 500;
const STATS_VISITS_DAYS = 30;
const STATS_TZ = 'Europe/Moscow';

function statsApcu(string $op, array $args = [])
{
    return call_user_func_array('apcu_' . $op, $args);
}

function statsClientIp(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown';
}

function statsIsBot(string $ua): bool
{
    return $ua === '' || preg_match('/bot|crawl|spider|slurp|curl|wget|python|java\/|go-http|headless|lighthouse|preview|monitor|facebookexternalhit|yandex\.com\/bots|metrika/i', $ua) === 1;
}

function statsParseUa(string $ua): array
{
    $device = 'desktop';
    if (preg_match('/ipad|tablet|(android(?!.*mobile))/i', $ua)) $device = 'tablet';
    elseif (preg_match('/mobi|iphone|ipod|android|phone/i', $ua)) $device = 'mobile';

    $os = 'Другая';
    foreach (['/windows nt/i' => 'Windows', '/iphone|ipad|ipod/i' => 'iOS', '/android/i' => 'Android', '/mac os x|macintosh/i' => 'macOS', '/cros/i' => 'ChromeOS', '/linux/i' => 'Linux'] as $re => $name) {
        if (preg_match($re, $ua)) { $os = $name; break; }
    }

    $browser = 'Другой';
    foreach (['/yabrowser/i' => 'Яндекс Браузер', '/edg(e|a|ios)?\//i' => 'Edge', '/opr\/|opera/i' => 'Opera', '/samsungbrowser/i' => 'Samsung Internet', '/firefox|fxios/i' => 'Firefox', '/chrome|crios/i' => 'Chrome', '/safari/i' => 'Safari'] as $re => $name) {
        if (preg_match($re, $ua)) { $browser = $name; break; }
    }
    return ['device' => $device, 'os' => $os, 'browser' => $browser];
}

function statsEmpty(): array
{
    return ['online' => [], 'days' => [], 'seen' => ['day' => '', 'ids' => []], 'visits' => [], 'total' => ['views' => 0, 'uniq' => 0]];
}

function statsWith(callable $fn)
{
    $priv = dirname(__DIR__, 2) . '/optika_private';
    if ((is_dir($priv) || @mkdir($priv, 0700, true)) && is_writable($priv)) {
        $file = $priv . '/stats.php';
    } else {
        $dir = __DIR__ . '/data';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        $file = $dir . '/stats.php';
    }
    $fh = @fopen($file, 'c+');
    if (!$fh) return null;
    flock($fh, LOCK_EX);
    $raw = (string) stream_get_contents($fh);
    $json = $raw !== '' ? substr($raw, (int) strpos($raw, "\n") + 1) : '';
    $data = json_decode($json !== '' ? $json : '[]', true);
    $data = is_array($data) ? array_merge(statsEmpty(), $data) : statsEmpty();
    $result = $fn($data);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, "<?php exit; ?>\n" . json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($file, 0600);
    return $result;
}

function statsPrune(array &$d, int $now): void
{
    foreach ($d['online'] as $id => $row) {
        if ($now - ($row['t'] ?? 0) > STATS_ONLINE_TTL) unset($d['online'][$id]);
    }
    $tz = new DateTimeZone(STATS_TZ);
    $minDay = (new DateTimeImmutable('@' . $now))->setTimezone($tz)->modify('-' . STATS_DAYS_KEEP . ' days')->format('Y-m-d');
    foreach (array_keys($d['days']) as $day) {
        if ($day < $minDay) unset($d['days'][$day]);
    }
    $minVisit = $now - STATS_VISITS_DAYS * 86400;
    $d['visits'] = array_values(array_filter($d['visits'], fn($v) => ($v['t'] ?? 0) >= $minVisit));
    if (count($d['visits']) > STATS_VISITS_KEEP) $d['visits'] = array_slice($d['visits'], -STATS_VISITS_KEEP);
}

function statsOnlineCount(array $d): int
{
    return count($d['online']);
}

function statsRecordVisit(array &$d, array $ctx): int
{
    $now = $ctx['now'];
    $id = $ctx['id'];
    $day = $ctx['day'];
    $info = $ctx['info'];
    statsPrune($d, $now);
    $wasOnline = isset($d['online'][$id]);
    if (!$wasOnline && count($d['online']) >= 300) {
        array_shift($d['online']);
    }
    $since = $wasOnline ? ($d['online'][$id]['since'] ?? $now) : $now;
    $d['online'][$id] = ['t' => $now, 'ip' => $ctx['ip'], 'device' => $info['device'], 'os' => $info['os'], 'browser' => $info['browser'], 'path' => $ctx['path'], 'since' => $since];
    $d['days'][$day] = $d['days'][$day] ?? ['views' => 0, 'uniq' => 0, 'mobile' => 0, 'tablet' => 0, 'desktop' => 0];
    if (($d['seen']['day'] ?? '') !== $day) {
        $d['seen'] = ['day' => $day, 'ids' => []];
    }
    if ($ctx['isNewPage']) {
        $d['days'][$day]['views']++;
        $d['total']['views']++;
    }
    if (!isset($d['seen']['ids'][$id]) && count($d['seen']['ids']) < 5000) {
        $d['seen']['ids'][$id] = 1;
        $d['days'][$day]['uniq']++;
        $d['days'][$day][$info['device']]++;
        $d['total']['uniq']++;
    }
    if (!$wasOnline) {
        $d['visits'][] = ['t' => $now, 'ip' => $ctx['ip'], 'device' => $info['device'], 'os' => $info['os'], 'browser' => $info['browser'], 'path' => $ctx['path'], 'ref' => $ctx['ref']];
    }
    return statsOnlineCount($d);
}

function statsTrack(string $path, string $ref, bool $isNewPage): ?int
{
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $ip = statsClientIp();
    $now = time();
    $day = (new DateTimeImmutable('@' . $now))->setTimezone(new DateTimeZone(STATS_TZ))->format('Y-m-d');
    $info = statsParseUa($ua);
    $id = substr(hash('sha256', $ip . '|' . $ua . '|optika-stats'), 0, 16);
    $hasApcu = function_exists('apcu_enabled') && (bool) statsApcu('enabled');
    if ($hasApcu && !$isNewPage && statsApcu('fetch', ['st_ping:' . $id])) {
        $cached = statsApcu('fetch', ['st_online']);
        if (is_int($cached) && $cached > 0) {
            return $cached;
        }
    }

    $ctx = ['id' => $id, 'ip' => $ip, 'now' => $now, 'day' => $day, 'info' => $info, 'path' => $path, 'ref' => $ref, 'isNewPage' => $isNewPage];
    $count = statsWith(fn(array &$d) => statsRecordVisit($d, $ctx));
    if ($hasApcu && is_int($count)) {
        statsApcu('store', ['st_ping:' . $id, 1, 20]);
        statsApcu('store', ['st_online', $count, 30]);
    }
    return $count;
}

function statsSnapshot(): array
{
    $now = time();
    $tz = new DateTimeZone(STATS_TZ);
    $dt = (new DateTimeImmutable('@' . $now))->setTimezone($tz);
    $today = $dt->format('Y-m-d');
    $snap = statsWith(function (array &$d) use ($now) {
        statsPrune($d, $now);
        return $d;
    });
    $d = is_array($snap) ? $snap : statsEmpty();

    $days = [];
    for ($i = 13; $i >= 0; $i--) {
        $k = $dt->modify("-$i days")->format('Y-m-d');
        $row = $d['days'][$k] ?? ['views' => 0, 'uniq' => 0];
        $days[] = ['date' => $k, 'views' => (int) $row['views'], 'uniq' => (int) $row['uniq']];
    }
    $sum = function (int $n) use ($d, $dt) {
        $views = $uniq = 0;
        for ($i = 0; $i < $n; $i++) {
            $row = $d['days'][$dt->modify("-$i days")->format('Y-m-d')] ?? null;
            if ($row) { $views += (int) $row['views']; $uniq += (int) $row['uniq']; }
        }
        return ['views' => $views, 'uniq' => $uniq];
    };
    $devices = ['mobile' => 0, 'tablet' => 0, 'desktop' => 0];
    foreach ($d['days'] as $row) {
        foreach ($devices as $k => $_) $devices[$k] += (int) ($row[$k] ?? 0);
    }
    $online = [];
    foreach ($d['online'] as $row) {
        $online[] = ['ip' => $row['ip'] ?? '', 'device' => $row['device'] ?? '', 'os' => $row['os'] ?? '', 'browser' => $row['browser'] ?? '', 'path' => $row['path'] ?? '/', 'since' => $row['since'] ?? $now];
    }
    usort($online, fn($a, $b) => $b['since'] <=> $a['since']);

    return [
        'now' => $now,
        'online' => count($online),
        'onlineList' => $online,
        'today' => $d['days'][$today] ?? ['views' => 0, 'uniq' => 0],
        'week' => $sum(7),
        'month' => $sum(30),
        'total' => $d['total'],
        'devices' => $devices,
        'days' => $days,
        'visits' => array_reverse(array_slice($d['visits'], -200)),
        'visitsDays' => STATS_VISITS_DAYS,
    ];
}
