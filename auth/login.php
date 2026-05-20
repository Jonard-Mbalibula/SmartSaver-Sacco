<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../config/db.php';

send_security_headers();
secure_session_start();

if (!empty($_SESSION['user_id'])) {
    if (($_SESSION['role'] ?? '') === 'admin') {
        header('Location: /DSLT/admin/dashboard.php');
        exit;
    }

    header('Location: /DSLT/member/dashboard.php');
    exit;
}

csrf_init();

$message = '';
$message_type = 'bad';
$phone = trim((string)($_POST['phone'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $password = (string)($_POST['password'] ?? '');

    if ($phone === '' || $password === '') {
        $message = 'Phone and password are required.';
        $message_type = 'bad';
    } else {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $throttleKey = hash('sha256', $ip . '|' . $phone);
        $windowSeconds = 300;
        $maxAttempts = 10;
        $now = time();

        if (!isset($_SESSION['login_throttle']) || !is_array($_SESSION['login_throttle'])) {
            $_SESSION['login_throttle'] = [];
        }

        $entry = $_SESSION['login_throttle'][$throttleKey] ?? ['count' => 0, 'first' => $now];
        if (($now - (int)$entry['first']) > $windowSeconds) {
            $entry = ['count' => 0, 'first' => $now];
        }

        if ((int)$entry['count'] >= $maxAttempts) {
            http_response_code(429);
            $message = 'Too many login attempts. Please wait a few minutes and try again.';
            $message_type = 'bad';
        } else {
            $stmt = $pdo->prepare(
                'SELECT user_id, role, full_name, password_hash FROM users WHERE phone = ? LIMIT 1'
            );
            $stmt->execute([$phone]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user && password_verify($password, $user['password_hash'])) {
                session_regenerate_id(true);
                $_SESSION['user_id'] = (int)$user['user_id'];
                $_SESSION['role'] = (string)$user['role'];
                $_SESSION['name'] = (string)$user['full_name'];
                unset($_SESSION['login_throttle'][$throttleKey]);

                if ($_SESSION['role'] === 'admin') {
                    header('Location: /DSLT/admin/dashboard.php');
                    exit;
                }

                header('Location: /DSLT/member/dashboard.php');
                exit;
            }

            $entry['count'] = (int)$entry['count'] + 1;
            $_SESSION['login_throttle'][$throttleKey] = $entry;
            usleep(300000);

            $message = 'Invalid login credentials.';
            $message_type = 'bad';
        }
    }
}

$title = 'Sign In';
$page_theme = 'auth';
$minimal_layout = true;
require_once __DIR__ . '/../includes/layout_top.php';
?>
<div class="auth-wrapper">
  <div class="auth-glow"></div>

  <div class="auth-container">
    <div class="auth-brand">
      <?php echo brand_image_tag('SmartSaver', 'auth-brand__logo', 88, 88); ?>
      SmartSaver
    </div>
    <div class="auth-sub">Sign in to manage savings and loans</div>

    <div class="card auth-card">
      <div class="card-h">Login</div>
      <div class="card-b">
        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>" role="alert" aria-live="polite"><?php echo h($message); ?></div>
        <?php endif; ?>

        <form method="POST" data-prevent-double-submit>
          <?php echo csrf_field(); ?>
          <label for="phone">Phone number</label>
          <input type="tel" id="phone" name="phone" value="<?php echo h($phone); ?>" autocomplete="username tel" inputmode="tel" autofocus required>

          <label for="password">Password</label>
          <div class="field-group">
            <input type="password" id="password" name="password" autocomplete="current-password" required>
            <button type="button" class="field-addon" data-password-toggle aria-controls="password" aria-pressed="false" aria-label="Show password">
              <span aria-hidden="true">Show</span>
            </button>
          </div>

          <button type="submit" class="btn btn--block" data-submit-label="Sign in">Sign in</button>
        </form>

        <p class="note">Don't have an account yet? <a href="/DSLT/auth/register.php">Create a member account</a></p>
      </div>
    </div>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/layout_bottom.php'; ?>
