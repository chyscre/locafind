<?php
declare(strict_types=1);

// Accounts for LocaFind: register, log in, log out, and the current user's profile.
//
//   POST auth.php?action=register  { studentNo, displayName, password, contact? }  -> 201 { token, user }
//   POST auth.php?action=login     { studentNo, password }                          -> 200 { token, user }
//   POST auth.php?action=logout    (Authorization: Bearer <token>)                  -> 200
//   GET  auth.php                  (Authorization: Bearer <token>)                  -> 200 { user }
//   PUT  auth.php                  { displayName?, contact?, avatar? }              -> 200 { user }

require_once __DIR__ . '/common.php';

send_cors();

const AVATARS = ['kitty', 'pup', 'bun', 'cub', 'hop', 'kit'];

function clean_student_no(mixed $value): string
{
    return strtoupper(trim((string)$value));
}

try {
    $pdo = get_db();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = (string)($_GET['action'] ?? '');

    // ----- who am I? -----
    if ($method === 'GET') {
        $user = require_user($pdo);
        respond(200, ['success' => true, 'data' => ['user' => to_user($user)]]);
    }

    // ----- update my profile -----
    if ($method === 'PUT') {
        $user = require_user($pdo);
        $input = read_json_body();
        $changes = [];

        if (array_key_exists('displayName', $input)) {
            $name = trim((string)$input['displayName']);
            if ($name === '' || mb_strlen($name) > 30) {
                respond(422, ['success' => false, 'message' => 'Display name must be 1 to 30 characters.']);
            }
            $changes['display_name'] = $name;
        }
        if (array_key_exists('contact', $input)) {
            $contact = trim((string)$input['contact']);
            if (mb_strlen($contact) > 80) {
                respond(422, ['success' => false, 'message' => 'Contact is too long (max 80 characters).']);
            }
            $changes['contact'] = $contact;
        }
        if (array_key_exists('avatar', $input)) {
            if (!in_array($input['avatar'], AVATARS, true)) {
                respond(422, ['success' => false, 'message' => 'Unknown avatar.']);
            }
            $changes['avatar'] = $input['avatar'];
        }

        if ($changes) {
            $sets = [];
            foreach (array_keys($changes) as $column) {
                $sets[] = "$column = :$column"; // column names come from the fixed list above
            }
            $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($changes + ['id' => $user['id']]);
        }

        $user = require_user($pdo);
        respond(200, ['success' => true, 'message' => 'Profile updated.', 'data' => ['user' => to_user($user)]]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST, PUT, OPTIONS');
        respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }

    // ----- register -----
    if ($action === 'register') {
        $input = read_json_body();
        $studentNo = clean_student_no($input['studentNo'] ?? '');
        $displayName = trim((string)($input['displayName'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $contact = trim((string)($input['contact'] ?? ''));

        $errors = [];
        if (!preg_match('/^[A-Z0-9-]{4,20}$/', $studentNo)) {
            $errors['studentNo'] = 'Student number must be 4 to 20 letters, numbers or dashes.';
        }
        if ($displayName === '' || mb_strlen($displayName) > 30) {
            $errors['displayName'] = 'Display name must be 1 to 30 characters.';
        }
        if (strlen($password) < 6 || strlen($password) > 72) {
            $errors['password'] = 'Password must be 6 to 72 characters.';
        }
        if (mb_strlen($contact) > 80) {
            $errors['contact'] = 'Contact is too long (max 80 characters).';
        }
        if ($errors) {
            respond(422, ['success' => false, 'message' => reset($errors), 'errors' => $errors]);
        }

        $check = $pdo->prepare('SELECT id FROM users WHERE student_no = :s');
        $check->execute(['s' => $studentNo]);
        if ($check->fetch()) {
            respond(409, ['success' => false, 'message' => 'That student number already has an account. Log in instead.']);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (student_no, display_name, password_hash, contact)
             VALUES (:s, :n, :p, :c)'
        );
        $stmt->execute([
            's' => $studentNo,
            'n' => $displayName,
            'p' => password_hash($password, PASSWORD_DEFAULT),
            'c' => $contact,
        ]);
        $userId = (int)$pdo->lastInsertId();
        $token = issue_token($pdo, $userId);

        $stmt = $pdo->prepare('SELECT id, student_no, display_name, contact, avatar FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        respond(201, [
            'success' => true,
            'message' => 'Account created.',
            'data' => ['token' => $token, 'user' => to_user($stmt->fetch())],
        ]);
    }

    // ----- log in -----
    if ($action === 'login') {
        $input = read_json_body();
        $studentNo = clean_student_no($input['studentNo'] ?? '');
        $password = (string)($input['password'] ?? '');

        $stmt = $pdo->prepare(
            'SELECT id, student_no, display_name, contact, avatar, password_hash FROM users WHERE student_no = :s'
        );
        $stmt->execute(['s' => $studentNo]);
        $user = $stmt->fetch();

        // Same message for an unknown student number and a wrong password.
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(401, ['success' => false, 'message' => 'Wrong student number or password.']);
        }

        $token = issue_token($pdo, (int)$user['id']);
        respond(200, [
            'success' => true,
            'message' => 'Logged in.',
            'data' => ['token' => $token, 'user' => to_user($user)],
        ]);
    }

    // ----- log out -----
    if ($action === 'logout') {
        $token = bearer_token();
        if ($token !== null) {
            $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE token_hash = :h');
            $stmt->execute(['h' => hash('sha256', $token)]);
        }
        respond(200, ['success' => true, 'message' => 'Logged out.']);
    }

    respond(400, ['success' => false, 'message' => 'Unknown action. Use register, login or logout.']);
} catch (PDOException $e) {
    error_log('LocaFind auth database error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Database error. Check the PHP error log.']);
} catch (Throwable $e) {
    error_log('LocaFind auth unexpected error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Internal server error.']);
}
