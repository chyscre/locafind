<?php
declare(strict_types=1);

// XAMPP defaults. Change these if your MySQL user or password is different.
const DB_HOST = 'localhost';
const DB_NAME = 'locafind';
const DB_USER = 'root';
const DB_PASS = '';

function get_db_connection(): PDO
{
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
