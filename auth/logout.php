<?php
require_once __DIR__ . '/../includes/security.php';

send_security_headers();
secure_session_start();

// Clear session data
$_SESSION = [];

// Destroy session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'] ?? '/',
        $params['domain'] ?? '',
        (bool)($params['secure'] ?? false),
        (bool)($params['httponly'] ?? true)
    );
}

// Destroy session
session_destroy();

// Redirect
header("Location: /DSLT/auth/login.php");
exit;