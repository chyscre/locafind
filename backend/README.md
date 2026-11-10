# LocaFind API (PHP + MySQL)

A small procedural PHP REST API for the LocaFind Ionic app, following the same pattern as the
class `students.php` example. It runs on XAMPP (Apache + MariaDB/MySQL).

## Install (XAMPP)

1. Copy the `api` and `sql` folders into `C:\xampp\htdocs\locafind\` (api has `config.php`, `common.php`, `reports.php`, `auth.php`).
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Import `sql/locafind.sql` in phpMyAdmin (Import tab), or run:
   `C:\xampp\mysql\bin\mysql.exe -u root < sql\locafind.sql`
   It creates the `locafind` database, the `reports` table, and 5 sample reports.
4. Check `api/config.php` if your MySQL user or password is not XAMPP's default (`root`, no password).
5. Open http://localhost/locafind/api/reports.php in a browser. You should see `{"success":true,"data":[...]}`.

> If you get another site's page instead (e.g. a 404 from an old project), Apache's
> `DocumentRoot` in `C:\xampp\apache\conf\httpd.conf` points to that project. Either set it back to
> `C:/xampp/htdocs`, or add this at the end of `httpd.conf` and restart Apache:
>
> ```apache
> Alias /locafind "C:/xampp/htdocs/locafind"
> <Directory "C:/xampp/htdocs/locafind">
>     Require all granted
> </Directory>
> ```

## Endpoints

All requests go to `api/reports.php`.

| Method | URL | Purpose |
| --- | --- | --- |
| GET | `/api/reports.php` | List all reports (newest first) |
| GET | `/api/reports.php?id=1` | Get one report |
| POST | `/api/reports.php` | Create a lost or found report |
| PUT | `/api/reports.php?id=1` | Change `status` and/or `custody` |
| DELETE | `/api/reports.php?id=1` | Delete a report for good |

Closing a report (`status` = `recovered`) keeps it as a record; DELETE removes it for good (for reports posted by mistake).

Example POST body (`Content-Type: application/json`):

```json
{
  "type": "lost",
  "name": "Blue umbrella",
  "category": "umbrella",
  "description": "Navy blue, white handle",
  "lat": 15.4431,
  "lng": 120.9392,
  "radius": 50,
  "reporterName": "Juan Dela Cruz",
  "contact": "Messenger: Juan Dela Cruz"
}
```

Found reports also need `photo` (a `data:image/...` base64 string) and may send `custody`
(`with_finder` or `security`).

Example PUT body: `{ "status": "recovered" }` or `{ "custody": "security" }`.

## Accounts (auth.php)

| Method | URL | Purpose |
| --- | --- | --- |
| POST | `/api/auth.php?action=register` | `{ studentNo, displayName, password, contact? }` → `201 { token, user }` |
| POST | `/api/auth.php?action=login` | `{ studentNo, password }` → `200 { token, user }` (401 if wrong) |
| POST | `/api/auth.php?action=logout` | Ends the current login |
| GET | `/api/auth.php` | The logged-in user |
| PUT | `/api/auth.php` | Update `displayName`, `contact`, `avatar` |

Send the token as `Authorization: Bearer <token>`. In `reports.php`, POST needs a login, and
PUT/DELETE only work for the report's owner (otherwise `401` or `403`).

If you set up the database before accounts existed, run `sql/locafind.sql` again: it adds the
`users` and `auth_tokens` tables and the `reports.user_id` column without touching your reports.

## Status codes

`200` OK · `201` created · `400` bad request · `401` not logged in · `403` not your report · `404` not found ·
`405` method not allowed · `409` student number taken ·
`422` validation failed · `500` server/database error.

## Using it from the phone

The phone can't reach `localhost` (that is the phone itself). In the app's
`src/environments/environment.prod.ts`, `apiUrl` is the laptop's Wi-Fi IP, e.g.
`http://192.168.254.160/locafind/api`.

- Phone and laptop must be on the **same Wi-Fi**.
- Allow Apache through **Windows Firewall** (Private networks) when Windows asks.
- If the laptop's IP changes, run `ipconfig`, update `apiUrl`, then `ionic build` and `npx cap sync android`.
- If the server can't be reached, the app switches to offline mode: sample reports, and new reports
  are saved on the phone only.

## Security note

Reading reports is open; creating needs a login, and only the owner can update or delete a report. Passwords are stored with `password_hash` (bcrypt) and login tokens are stored as SHA-256 hashes.
It still runs over plain HTTP on the local network: put it behind HTTPS before using it on the public internet.
