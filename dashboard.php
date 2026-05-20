<?php
require __DIR__ . '/includes/security.php';

send_security_headers();
secure_session_start();

if (!isset($_SESSION['user_id'])) {
    header('Location: /DSLT/auth/login.php');
    exit;
}

if (($_SESSION['role'] ?? '') === 'admin') {
    header('Location: /DSLT/admin/dashboard.php');
    exit;
}

header('Location: /DSLT/member/dashboard.php');
exit;