<?php
$host = getenv('DSLT_DB_HOST') ?: 'localhost';
$db   = getenv('DSLT_DB_NAME') ?: 'dslt_db';
$user = getenv('DSLT_DB_USER') ?: 'root';      // default XAMPP username
$pass = getenv('DSLT_DB_PASS') ?: '';          // default XAMPP password is empty

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    error_log("DSLT DB connection failed: " . $e->getMessage());
    http_response_code(500);
    die("Database connection failed.");
}
