<?php
// Public read-only music metadata for the GitHub Pages calendar.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
function failRequest(int $status): void {
    http_response_code($status);
    header('Cache-Control: no-store');
    echo '{"error":"Music lookup unavailable"}';
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    failRequest(405);
}
if (count($_GET) !== 1) failRequest(400);
$key = array_key_first($_GET);
$value = $_GET[$key];
if (!is_string($value)) failRequest(400);
if ($key === 'search' && trim($value) !== '' && strlen($value) <= 256) {
    $path = '/search/artist?q=' . rawurlencode($value) . '&limit=1';
} elseif (($key === 'track' || $key === 'related') && preg_match('/^[1-9][0-9]{0,15}$/D', $value)) {
    $path = $key === 'track' ? '/track/' . $value : '/artist/' . $value . '/related?limit=20';
} else {
    failRequest(400);
}

$curl = curl_init('https://api.deezer.com' . $path);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 6,
]);
$body = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$data = is_string($body) ? json_decode($body, true) : null;
if ($status !== 200 || !is_array($data) || isset($data['error'])) failRequest(502);
if ($key === 'track') {
    $result = ['preview' => $data['preview'] ?? null];
} else {
    $artists = [];
    foreach ($data['data'] ?? [] as $artist) {
        if (isset($artist['id'], $artist['name'])) {
            $artists[] = ['id' => $artist['id'], 'name' => $artist['name']];
        }
    }
    $result = ['data' => $artists];
}
header('Cache-Control: public, max-age=' . ($key === 'track' ? '30' : '600'));
echo json_encode($result);
