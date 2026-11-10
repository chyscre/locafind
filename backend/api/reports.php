<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set('Asia/Manila');

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

const TYPES = ['lost', 'found'];
const CATEGORIES = ['id', 'bag', 'umbrella', 'gadget', 'tumbler', 'clothing', 'keys', 'other'];
const CUSTODY = ['with_finder', 'security', 'returned'];
const STATUSES = ['active', 'recovered'];
const MAX_PHOTO_CHARS = 700000; // about 500 KB of image; the app sends ~100-200 KB

// Columns returned to the app, renamed to the camelCase names the Angular model uses.
const SELECT_REPORT = 'SELECT id, type, name, category, description, photo, lat, lng, radius,
        reporter_name AS reporterName, contact, custody, status,
        occurred_at AS occurredAt, created_at AS createdAt
    FROM reports';

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

/** Turns a database row into the JSON shape of the app's Report interface. */
function to_report(array $row): array
{
    $report = [
        'id' => (string)$row['id'],
        'type' => $row['type'],
        'name' => $row['name'],
        'category' => $row['category'],
        'description' => $row['description'],
        'lat' => (float)$row['lat'],
        'lng' => (float)$row['lng'],
        'reporterName' => $row['reporterName'],
        'contact' => $row['contact'],
        'status' => $row['status'],
        'createdAt' => (new DateTime($row['createdAt']))->format(DATE_ATOM),
    ];
    // Optional fields are left out when empty, like in the app.
    if ($row['photo'] !== null) $report['photo'] = $row['photo'];
    if ($row['radius'] !== null) $report['radius'] = (int)$row['radius'];
    if ($row['custody'] !== null) $report['custody'] = $row['custody'];
    if ($row['occurredAt'] !== null) $report['occurredAt'] = (new DateTime($row['occurredAt']))->format(DATE_ATOM);

    return $report;
}

function find_report(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(SELECT_REPORT . ' WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return $row ? to_report($row) : null;
}

function validate_new_report(array $input): array
{
    $type = (string)($input['type'] ?? '');
    $name = trim((string)($input['name'] ?? ''));
    $category = (string)($input['category'] ?? '');
    $description = trim((string)($input['description'] ?? ''));
    $reporterName = trim((string)($input['reporterName'] ?? ''));
    $contact = trim((string)($input['contact'] ?? ''));
    $lat = filter_var($input['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($input['lng'] ?? null, FILTER_VALIDATE_FLOAT);
    $photo = $input['photo'] ?? null;
    $radius = $input['radius'] ?? null;
    $custody = $input['custody'] ?? null;

    $errors = [];
    if (!in_array($type, TYPES, true)) $errors['type'] = 'Type must be lost or found.';
    if ($name === '' || mb_strlen($name) > 60) $errors['name'] = 'Item name is required (max 60 characters).';
    if (!in_array($category, CATEGORIES, true)) $errors['category'] = 'Category is not valid.';
    if (mb_strlen($description) > 240) $errors['description'] = 'Description is too long (max 240 characters).';
    if ($reporterName === '' || mb_strlen($reporterName) > 60) $errors['reporterName'] = 'Your name is required.';
    if ($contact === '' || mb_strlen($contact) > 80) $errors['contact'] = 'Contact is required.';
    if ($lat === false || $lat < -90 || $lat > 90) $errors['lat'] = 'Latitude is not valid.';
    if ($lng === false || $lng < -180 || $lng > 180) $errors['lng'] = 'Longitude is not valid.';

    if ($photo !== null) {
        if (!is_string($photo) || strncmp($photo, 'data:image/', 11) !== 0) {
            $errors['photo'] = 'Photo must be an image.';
        } elseif (strlen($photo) > MAX_PHOTO_CHARS) {
            $errors['photo'] = 'Photo is too large.';
        }
    }
    if ($type === 'found' && $photo === null) $errors['photo'] = 'A photo is required for found items.';

    if ($type === 'lost' && $radius !== null) {
        $radius = filter_var($radius, FILTER_VALIDATE_INT);
        if ($radius === false || $radius < 1 || $radius > 200) $errors['radius'] = 'Radius must be 1 to 200 metres.';
    } else {
        $radius = null;
    }

    if ($type === 'found') {
        $custody = $custody ?? 'with_finder';
        if (!in_array($custody, CUSTODY, true)) $errors['custody'] = 'Custody is not valid.';
    } else {
        $custody = null;
    }

    if ($errors) {
        respond(422, ['success' => false, 'message' => 'Validation failed.', 'errors' => $errors]);
    }

    return [
        'type' => $type,
        'name' => $name,
        'category' => $category,
        'description' => $description,
        'photo' => $photo,
        'lat' => $lat,
        'lng' => $lng,
        'radius' => $radius,
        'reporter_name' => $reporterName,
        'contact' => $contact,
        'custody' => $custody,
    ];
}

/** PUT only changes the status and/or custody of a report. */
function validate_update(array $input): array
{
    $changes = [];
    if (array_key_exists('status', $input)) {
        if (!in_array($input['status'], STATUSES, true)) {
            respond(422, ['success' => false, 'message' => 'Status must be active or recovered.']);
        }
        $changes['status'] = $input['status'];
    }
    if (array_key_exists('custody', $input)) {
        if (!in_array($input['custody'], CUSTODY, true)) {
            respond(422, ['success' => false, 'message' => 'Custody is not valid.']);
        }
        $changes['custody'] = $input['custody'];
    }
    if (!$changes) {
        respond(400, ['success' => false, 'message' => 'Send status and/or custody to update.']);
    }

    return $changes;
}

try {
    $pdo = get_db_connection();
    $pdo->exec("SET time_zone = '+08:00'");
    $method = $_SERVER['REQUEST_METHOD'];
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

    if (isset($_GET['id']) && ($id === false || $id === null || $id < 1)) {
        respond(400, ['success' => false, 'message' => 'The id parameter must be a positive integer.']);
    }

    switch ($method) {
        case 'GET':
            if ($id !== null && $id !== false) {
                $report = find_report($pdo, $id);
                if (!$report) {
                    respond(404, ['success' => false, 'message' => 'Report not found.']);
                }
                respond(200, ['success' => true, 'data' => $report]);
            }

            $rows = $pdo->query(SELECT_REPORT . ' ORDER BY created_at DESC, id DESC')->fetchAll();
            respond(200, ['success' => true, 'data' => array_map('to_report', $rows)]);

        case 'POST':
            $report = validate_new_report(read_json_body());
            $stmt = $pdo->prepare(
                'INSERT INTO reports (type, name, category, description, photo, lat, lng, radius, reporter_name, contact, custody)
                 VALUES (:type, :name, :category, :description, :photo, :lat, :lng, :radius, :reporter_name, :contact, :custody)'
            );
            $stmt->execute($report);

            $created = find_report($pdo, (int)$pdo->lastInsertId());
            respond(201, ['success' => true, 'message' => 'Report created.', 'data' => $created]);

        case 'PUT':
            if ($id === null || $id === false) {
                respond(400, ['success' => false, 'message' => 'Provide a report id in the query string, e.g. ?id=1.']);
            }
            $changes = validate_update(read_json_body());

            if (!find_report($pdo, $id)) {
                respond(404, ['success' => false, 'message' => 'Report not found.']);
            }

            $sets = [];
            foreach (array_keys($changes) as $column) {
                $sets[] = "$column = :$column"; // column names come from the fixed list in validate_update
            }
            $stmt = $pdo->prepare('UPDATE reports SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($changes + ['id' => $id]);

            respond(200, ['success' => true, 'message' => 'Report updated.', 'data' => find_report($pdo, $id)]);

        case 'DELETE':
            // Removes a report for good (e.g. posted by mistake). Closing a report with
            // PUT { "status": "recovered" } keeps it as a record instead.
            if ($id === null || $id === false) {
                respond(400, ['success' => false, 'message' => 'Provide a report id in the query string, e.g. ?id=1.']);
            }

            $stmt = $pdo->prepare('DELETE FROM reports WHERE id = :id');
            $stmt->execute(['id' => $id]);

            if ($stmt->rowCount() === 0) {
                respond(404, ['success' => false, 'message' => 'Report not found.']);
            }

            respond(200, ['success' => true, 'message' => 'Report deleted.']);

        default:
            header('Allow: GET, POST, PUT, DELETE, OPTIONS');
            respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
} catch (PDOException $e) {
    error_log('LocaFind API database error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Database error. Check the PHP error log.']);
} catch (Throwable $e) {
    error_log('LocaFind API unexpected error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Internal server error.']);
}
