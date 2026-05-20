<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (($_SESSION["role"] ?? "") !== "admin") {
    header("Location: /DSLT/auth/login.php");
    exit;
}

$q = trim($_GET["q"] ?? "");
$params = [];
$sql = "
  SELECT a.audit_id, a.created_at, a.action, a.target_type, a.target_id, a.details,
         u.full_name AS actor_name, u.phone AS actor_phone
  FROM audit_logs a
  JOIN users u ON u.user_id = a.actor_user_id
";

if ($q !== "") {
    $sql .= " WHERE (a.action LIKE ? OR a.target_type LIKE ? OR a.details LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)";
    $params = ["%$q%","%$q%","%$q%","%$q%","%$q%"];
}

$sql .= " ORDER BY a.created_at DESC LIMIT 300";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$title = "Activity Logs";
require __DIR__ . '/../includes/layout_top.php';
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
            <h1>Activity Logs</h1>
            <p>Review recent admin actions and important system changes.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Shown</strong><br>
              <?php echo count($rows); ?> latest records
            </div>
            <div class="hero-note">
              <strong>Filter</strong><br>
              <?php echo $q !== '' ? h($q) : 'All activity'; ?>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>Find Activity</h3>
          <form method="GET">
            <label for="q">Search action, user, phone, or details</label>
            <input type="text" id="q" name="q" value="<?php echo h($q); ?>" placeholder="Example: loan approved or member name">
            <button type="submit">Search</button>
          </form>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Activity</div>
      <div class="card-b">
        <?php if (!$rows): ?>
          <div class="empty-state">No activity records found.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
              <?php foreach ($rows as $r): ?>
              <tr>
                <td><?php echo h(format_datetime($r["created_at"] ?? null)); ?></td>
                <td><?php echo h($r["actor_name"]); ?><div class="note"><?php echo h($r["actor_phone"]); ?></div></td>
                <td><?php echo h(str_replace('_', ' ', (string)$r["action"])); ?></td>
                <td><?php echo h($r["target_type"] . " #" . ($r["target_id"] ?? "N/A")); ?></td>
                <td class="break-text">
                  <?php echo h($r["details"]); ?>
                </td>
              </tr>
              <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
        <p class="note">Activity logs are kept for review and should not be edited.</p>
      </div>
    </div>
  </div>
</div>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
