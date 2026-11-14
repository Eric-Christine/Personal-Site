<?php
// Free official EIA weekly retail averages. No API key or paid service is used.
const CARBON_EIA_FEED = 'https://www.eia.gov/petroleum/gasdiesel/includes/gas_diesel_rss.xml';
const CARBON_EIA_SOURCE = 'https://www.eia.gov/petroleum/gasdiesel/';

function carbon_parse_fuel_feed(string $body, int $now): array {
    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$xml || !isset($xml->channel->item[0])) throw new RuntimeException('Invalid EIA feed');
    $item = $xml->channel->item[0];
    if (!preg_match('~Data For\s+(\d{2}/\d{2}/\d{2})~i', (string)$item->title, $match)) {
        throw new RuntimeException('Missing EIA observation date');
    }
    $date = DateTimeImmutable::createFromFormat('!m/d/y', $match[1], new DateTimeZone('UTC'));
    if (!$date || $date->format('m/d/y') !== $match[1] || $date->getTimestamp() > $now + 86400) {
        throw new RuntimeException('Invalid EIA observation date');
    }
    $text = preg_replace('~<br\s*/?>~i', "\n", (string)$item->description);
    $lines = explode("\n", html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $gasoline = []; $diesel = []; $section = null;
    foreach ($lines as $line) {
        if (stripos($line, 'Regular Gasoline Retail Price') !== false) $section = 'gasoline';
        if (stripos($line, 'On-Highway Diesel Fuel Retail Price') !== false) $section = 'diesel';
        if (!$section || !preg_match('~^\s*(\d+(?:\.\d+)?)\s+\.{2,}\s*(.+?)\s*$~', $line, $parts)) continue;
        $price = (float)$parts[1];
        if (!is_finite($price) || $price <= 0) continue;
        $name = trim($parts[2]);
        $id = $name === 'U.S.' ? 'us' : trim(preg_replace('~[^a-z0-9]+~', '-', strtolower($name)), '-');
        $row = ['id' => $id, 'name' => $name, 'price' => $price];
        if ($section === 'gasoline') $gasoline[$id] = $row;
        else $diesel[$id] = $row;
    }
    if (!isset($gasoline['us']) || !isset($diesel['us'])) throw new RuntimeException('Incomplete EIA prices');
    return [
        'source' => 'U.S. Energy Information Administration (EIA)', 'sourceUrl' => CARBON_EIA_SOURCE,
        'unit' => 'USD/US gallon', 'asOf' => $date->format('Y-m-d'),
        'fetchedAt' => gmdate('c', $now), 'stale' => $now - $date->getTimestamp() > 14 * 86400,
        'gasoline' => array_values($gasoline), 'diesel' => array_values($diesel),
    ];
}

function carbon_fetch_fuel_prices(): array {
    $curl = curl_init(CARBON_EIA_FEED);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'CarbonCommute/1.3 (+https://ericchristine.com/projects/calculator/)',
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
    $body = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE); curl_close($curl);
    if (!is_string($body) || $status !== 200 || strlen($body) > 2000000) throw new RuntimeException('EIA unavailable');
    return carbon_parse_fuel_feed($body, time());
}

function carbon_cached_fuel_prices(string $cacheDir, callable $fetcher, int $now): array {
    if (!is_dir($cacheDir) && !@mkdir($cacheDir, 0700, true)) throw new RuntimeException('Price cache unavailable');
    $cacheFile = $cacheDir . '/fuel-prices.json';
    $failureFile = $cacheDir . '/last-failure';
    $lock = fopen($cacheDir . '/fuel-prices.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Price cache busy');
    try {
        $saved = is_file($cacheFile) ? json_decode(file_get_contents($cacheFile), true) : null;
        if (!is_array($saved) || !isset($saved['asOf'], $saved['fetchedAt'], $saved['gasoline'], $saved['diesel'])) $saved = null;
        $cachedAt = $saved ? strtotime($saved['fetchedAt']) : false;
        $lastFailure = is_file($failureFile) ? (int)file_get_contents($failureFile) : 0;
        if ($saved && $cachedAt && $now - $cachedAt >= 0 && $now - $cachedAt < 6 * 3600) {
            $data = $saved;
        } else {
            try {
                if ($lastFailure && $now - $lastFailure < 300) throw new RuntimeException('Retry after cooldown');
                $data = $fetcher();
                $encoded = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
                $temp = $cacheFile . '.new';
                if (file_put_contents($temp, $encoded) === false || !rename($temp, $cacheFile)) throw new RuntimeException('Could not cache prices');
                chmod($cacheFile, 0600);
                if (is_file($failureFile)) unlink($failureFile);
            } catch (Throwable $error) {
                // Do not extend the cooldown on every request or an outage could never recover.
                if (!$lastFailure || $now - $lastFailure >= 300) file_put_contents($failureFile, (string)$now);
                if (!$saved || !$cachedAt) throw $error;
                $data = $saved; $data['stale'] = true;
                $data['notice'] = 'EIA is unavailable. Showing the last successfully fetched prices.';
            }
        }
        $data['stale'] = $data['stale'] || $now - strtotime($data['asOf'] . 'T00:00:00Z') > 14 * 86400;
        return $data;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function carbon_serve_fuel_prices(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('X-Content-Type-Options: nosniff');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') { http_response_code(405); echo '{"error":"GET required"}'; return; }
    // This endpoint lives in public_html/projects/calculator/api; cache stays in the account home.
    $data = carbon_cached_fuel_prices(dirname(__DIR__, 4) . '/.carbon-commute-cache', 'carbon_fetch_fuel_prices', time());
    header('Cache-Control: public, max-age=' . ($data['stale'] ? '300' : '1800'));
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
}

if (!defined('CARBON_FUEL_TEST')) {
    try { carbon_serve_fuel_prices(); }
    catch (Throwable $error) {
        http_response_code(503); header('Cache-Control: no-store');
        echo '{"error":"Fuel prices are temporarily unavailable. Enter a local price or try again later."}';
    }
}
