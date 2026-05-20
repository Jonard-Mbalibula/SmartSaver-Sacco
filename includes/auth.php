<?php
require_once __DIR__ . '/security.php';
send_security_headers();
secure_session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /DSLT/auth/login.php");
    exit();
}
