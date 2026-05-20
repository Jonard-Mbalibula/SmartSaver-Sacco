<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/audit.php';
require __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/app_helpers.php';

csrf_init();

if (($_SESSION["role"] ?? "") !== "admin") {
    header("Location: /DSLT/auth/login.php");
    exit;
}

$user_id = (int)($_GET["user_id"] ?? 0);
if ($user_id <= 0) {
    exit("Invalid member.");
}

$stmt = $pdo->prepare("SELECT user_id, full_name, phone FROM users WHERE user_id=? AND role='member'");
$stmt->execute([$user_id]);
$member = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$member) {
    exit("Member not found.");
}

$title = "Edit Member";
require __DIR__ . '/../includes/layout_top.php';

$message = "";
$message_type = "ok";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    csrf_verify();

    $full_name = trim($_POST["full_name"] ?? "");
    $phone     = trim($_POST["phone"] ?? "");

    if ($full_name === "" || $phone === "") {
        $message = "All fields are required.";
        $message_type = "bad";
    } else {
        $before = [
            "full_name" => $member["full_name"],
            "phone" => $member["phone"]
        ];

        try {
            $stmt = $pdo->prepare("UPDATE users SET full_name=?, phone=? WHERE user_id=? AND role='member'");
            $stmt->execute([$full_name, $phone, $user_id]);

            audit_log(
                $pdo,
                (int)$_SESSION["user_id"],
                "member_updated",
                "user",
                (int)$user_id,
                [
                    "before" => $before,
                    "after" => ["full_name" => $full_name, "phone" => $phone]
                ]
            );

            $message = "Member updated successfully.";
            $message_type = "ok";

            // Refresh member values
            $stmt = $pdo->prepare("SELECT user_id, full_name, phone FROM users WHERE user_id=? AND role='member'");
            $stmt->execute([$user_id]);
            $member = $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (PDOException $e) {
            $message = "Update failed. Phone may already exist.";
            $message_type = "bad";
        }
    }
}
?>

<div class="grid">
  <div class="card">
    <div class="card-h">Menu</div>
    <div class="card-b">
      <?php require __DIR__ . '/../includes/nav.php'; ?>
    </div>
  </div>

  <div class="content-stack">
    <div class="card">
      <div class="card-b">
        <div class="hero">
          <div>
            <h1>Edit Member</h1>
            <p>Update the member name or phone number used across the system.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Member</strong><br>
              <?php echo h($member["full_name"]); ?>
            </div>
            <div class="hero-note">
              <strong>Phone</strong><br>
              <?php echo h($member["phone"]); ?>
            </div>
          </div>
        </div>

      <?php if (!empty($message)): ?>
        <div class="alert <?php echo h($message_type); ?>">
          <?php echo h($message); ?>
        </div>
      <?php endif; ?>

        <div class="section">
          <h3>Member Details</h3>
          <form method="POST">
            <?php echo csrf_field(); ?>

            <label for="full_name">Full Name</label>
            <input type="text" id="full_name" name="full_name" value="<?php echo h($member["full_name"]); ?>" required>

            <label for="phone">Phone</label>
            <input type="text" id="phone" name="phone" value="<?php echo h($member["phone"]); ?>" required>

            <button type="submit">Save Changes</button>
          </form>
        </div>

      <p class="note">
        <a href="/DSLT/admin/members_view.php?user_id=<?php echo (int)$user_id; ?>">Back to member</a>
      </p>

      </div>
    </div>
  </div>
</div>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
