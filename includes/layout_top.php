<?php
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/app_helpers.php';

send_security_headers();
secure_session_start();

$requestPath = (string)(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '');
$pageTheme = $page_theme ?? '';

if ($pageTheme === '') {
    if (strpos($requestPath, '/DSLT/admin/') === 0) {
        $pageTheme = 'admin';
    } elseif (strpos($requestPath, '/DSLT/savings/') === 0) {
        $pageTheme = 'savings';
    } elseif (strpos($requestPath, '/DSLT/loans/') === 0) {
        $pageTheme = 'loans';
    } elseif (strpos($requestPath, '/DSLT/member/') === 0) {
        $pageTheme = 'member';
    } elseif (strpos($requestPath, '/DSLT/auth/') === 0) {
        $pageTheme = 'auth';
    } else {
        $pageTheme = 'default';
    }
}

$isLoggedIn = !empty($_SESSION['user_id']);
$minimalLayout = (bool)($minimal_layout ?? false);
$stylesheetPath = __DIR__ . '/../assets/css/style.css';
$stylesheetVersion = is_file($stylesheetPath) ? (string)filemtime($stylesheetPath) : '1';

if (!$minimalLayout && $pageTheme === 'auth' && !$isLoggedIn) {
    $minimalLayout = true;
}

$bodyClasses = ['app-body'];
if ($minimalLayout) {
    $bodyClasses[] = 'app-body--auth';
}
if ($isLoggedIn) {
    $bodyClasses[] = 'app-body--signed-in';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="SmartSaver — savings, loans, and member records">
  <title><?php echo h($title ?? 'DSLT'); ?></title>
  <link rel="icon" href="<?php echo h(brand_image_url()); ?>">
  <link rel="stylesheet" href="/DSLT/assets/css/style.css?v=<?php echo h($stylesheetVersion); ?>">
  <?php if (!empty($include_chartjs)): ?>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <?php endif; ?>
</head>
<body class="<?php echo h(implode(' ', $bodyClasses)); ?>" data-theme="<?php echo h($pageTheme); ?>">
<?php if ($minimalLayout): ?>
  <header class="auth-top">
    <a class="auth-top__brand" href="/DSLT/auth/login.php">
      <span class="brand-mark brand-mark--sm"><?php echo brand_image_tag('SmartSaver', 'brand-mark__img', 38, 38); ?></span>
      <span>SmartSaver</span>
    </a>
  </header>
<?php else: ?>
<div class="container">
  <div class="topbar" role="banner">
    <div class="brand-wrap">
      <div class="brand-mark"><?php echo brand_image_tag('SmartSaver', 'brand-mark__img', 48, 48); ?></div>
      <div>
        <div class="brand">SmartSaver</div>
        <div class="brand-sub">Savings, loans, and member records</div>
      </div>
    </div>
    <?php if ($isLoggedIn): ?>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="app-sidebar" data-nav-toggle>
        <span class="nav-toggle__bar" aria-hidden="true"></span>
        <span class="nav-toggle__label">Menu</span>
      </button>
    <?php endif; ?>
    <div class="session-chip">
      <?php if ($isLoggedIn): ?>
        <span class="session-name"><?php echo h($_SESSION['name'] ?? ''); ?></span>
        <span class="session-sep" aria-hidden="true">|</span>
        <span class="session-role"><?php echo h(ucfirst((string)($_SESSION['role'] ?? 'guest'))); ?></span>
      <?php else: ?>
        <a href="/DSLT/auth/login.php">Sign in</a>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>
