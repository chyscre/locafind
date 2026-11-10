<?php
declare(strict_types=1);

// Shared by reports.php and auth.php: CORS, JSON responses, and login (token) checks.

require_once __DIR__ . '/config.php';

date_default_timezone_set('Asia/Manila');

const TOKEN_DAYS = 30;

function send_cors(): void
{
    // Development CORS allow-list (same idea as the class students.php example).
    $allowedOrigins = [
        'http://localhost',          // Android app (Capacitor, androidScheme "http")
        'https://localhost',         // Android app (Capacitor default scheme)
        'capacitor://localhost',
        'ionic://localhost',
        'http://localhost:4200',     // ng serve
        'http://localhost:8100',     // ionic serve
        'http://127.0.0.1:8100',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        respond(400, ['success' => false, 'message' => 'Request body is required.']);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(400, ['success' => false, 'message' => 'Invalid JSON request body.']);
    }

    return $decoded;
}

function get_db(): PDO
{
    $pdo = get_db_connection();
    $pdo->exec("SET time_zone = '+08:00'");
    return $pdo;
}

// ---------------------------------------------------------------- login tokens

/** The token from "Authorization: Bearer <token>", or null. */
function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
            }
        }
    }
    if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($header), $m)) {
        return strtolower($m[1]);
    }
    return null;
}

/** Create a new random token for a user. Only its SHA-256 hash is stored. */
function issue_token(PDO $pdo, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare(
        'INSERT INTO auth_tokens (token_hash, user_id, expires_at)
         VALUES (:h, :u, DATE_ADD(NOW(), INTERVAL ' . TOKEN_DAYS . ' DAY))'
    );
    $stmt->execute(['h' => hash('sha256', $token), 'u' => $userId]);
    return $token;
}

/** The logged-in user for this request, or null. */
function current_user(PDO $pdo): ?array
{
    $token = bearer_token();
    if ($token === null) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT u.id, u.student_no, u.display_name, u.contact, u.avatar
         FROM auth_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = :h AND t.expires_at > NOW()'
    );
    $stmt->execute(['h' => hash('sha256', $token)]);
    $user = $stmt->fetch();
    return $user ?: null;
}

/** Stop with 401 unless the request carries a valid login token. */
function require_user(PDO $pdo): array
{
    $user = current_user($pdo);
    if (!$user) {
        respond(401, ['success' => false, 'message' => 'Please log in first.']);
    }
    return $user;
}

/** A user row in the JSON shape the app uses. */
function to_user(array $u): array
{
    return [
        'id' => (string)$u['id'],
        'studentNo' => $u['student_no'],
        'displayName' => $u['display_name'],
        'contact' => $u['contact'],
        'avatar' => $u['avatar'],
    ];
}
