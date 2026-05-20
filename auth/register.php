<?php
require __DIR__ . '/../includes/security.php';
require __DIR__ . '/../config/db.php';

send_security_headers();
secure_session_start();
csrf_init();

$message = '';
$message_type = 'bad';
$fullName = trim((string)($_POST['full_name'] ?? ''));
$phone = trim((string)($_POST['phone'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $password = (string)($_POST['password'] ?? '');

    if ($fullName === '' || $phone === '' || $password === '') {
        $message = 'All fields are required.';
        $message_type = 'bad';
    } elseif (strlen($password) < 6) {
        $message = 'Password must be at least 6 characters long.';
        $message_type = 'bad';
    } else {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        try {
            $stmt = $pdo->prepare(
                "INSERT INTO users (full_name, phone, password_hash, role)
                 VALUES (?, ?, ?, 'member')"
            );
            $stmt->execute([$fullName, $phone, $passwordHash]);

            $message = 'Registration successful. You can now sign in.';
            $message_type = 'ok';
            $fullName = '';
            $phone = '';
        } catch (PDOException $e) {
            $message = 'Phone number already exists.';
            $message_type = 'bad';
        }
    }
}

$title = 'Register';
require __DIR__ . '/../includes/layout_top.php';
?>
<div class="auth-wrapper">
  <div class="auth-glow"></div>

  <div class="auth-container">
    <div class="auth-brand">
      <?php echo brand_image_tag('SmartSaver', 'auth-brand__logo', 88, 88); ?>
      SmartSaver
    </div>
    <div class="auth-sub">Create your member account</div>

    <div class="card auth-card">
      <div class="card-h">Register</div>
      <div class="card-b">
        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>"><?php echo h($message); ?></div>
        <?php endif; ?>

        <form method="POST">
          <?php echo csrf_field(); ?>
          <label for="full_name">Full Name</label>
          <input type="text" id="full_name" name="full_name" value="<?php echo h($fullName); ?>" required>

          <label for="phone">Phone Number</label>
          <input type="text" id="phone" name="phone" value="<?php echo h($phone); ?>" required>

          <label for="password">Password</label>
          <div class="field-group">
            <input type="password" id="password" name="password" autocomplete="new-password" minlength="6" required>
            <button type="button" class="field-addon" data-password-toggle aria-controls="password" aria-pressed="false">Show</button>
          </div>

          <button type="submit" class="btn btn--block">Register</button>
        </form>

        <p class="note">Already registered? <a href="/DSLT/auth/login.php">Go to login</a></p>
      </div>
    </div>
  </div>
</div>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
