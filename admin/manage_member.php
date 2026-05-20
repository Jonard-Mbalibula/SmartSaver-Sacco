<?php
require __DIR__ . '/../includes/auth.php';

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    header('Location: /DSLT/admin/members.php');
    exit;
}

header('Location: /DSLT/admin/members_view.php?user_id=' . $userId);
exit;
