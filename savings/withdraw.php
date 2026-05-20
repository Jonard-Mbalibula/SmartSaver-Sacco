<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/app_helpers.php';

csrf_init();

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'member') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];
$redirectUrl = '/DSLT/savings/withdraw.php';
$message = '';
$message_type = 'ok';
$flash = flash_get('member_withdraw');
if ($flash !== null) {
    $message = $flash['message'];
    $message_type = $flash['type'];
}

$stmt = $pdo->prepare(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals,
        MAX(CASE WHEN type='withdraw' THEN created_at END) AS last_withdrawal
     FROM transactions
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

$deposits = (float)($summary['deposits'] ?? 0);
$withdrawals = (float)($summary['withdrawals'] ?? 0);
$balance = $deposits - $withdrawals;
$lastWithdrawal = $summary['last_withdrawal'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    if (!form_token_verify('member_withdraw')) {
        flash_set('member_withdraw', 'This form was already submitted. Refresh the page and try again.', 'bad');
        header('Location: ' . $redirectUrl);
        exit;
    }

    $amount = (float)($_POST['amount'] ?? 0);

    if ($amount <= 0) {
        flash_set('member_withdraw', 'Enter a valid withdrawal amount.', 'bad');
    } elseif ($amount > $balance) {
        flash_set('member_withdraw', 'Withdrawal amount exceeds available balance.', 'bad');
    } else {
        $stmt = $pdo->prepare(
            "INSERT INTO transactions (user_id, type, amount, is_reversal, reversed_transaction_id)
             VALUES (?, 'withdraw', ?, 0, NULL)"
        );
        $stmt->execute([$userId, $amount]);

        $withdrawals += $amount;
        $balance -= $amount;
        flash_set('member_withdraw', 'Withdrawal recorded successfully.', 'ok');
    }

    header('Location: ' . $redirectUrl);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT id, amount, created_at
     FROM transactions
     WHERE user_id = ? AND type = 'withdraw'
     ORDER BY created_at DESC
     LIMIT 8"
);
$stmt->execute([$userId]);
$recentWithdrawals = $stmt->fetchAll(PDO::FETCH_ASSOC);

$title = 'Withdraw';
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
            <h1>Withdraw</h1>
            <p>Take money from savings. The system will not allow more than your available balance.</p>
            <?php if ($balance > 0): ?>
              <div class="action-row">
                <button type="button" class="btn secondary js-fill-amount" data-amount="<?php echo h(number_format($balance * 0.25, 2, '.', '')); ?>">25% of balance</button>
                <button type="button" class="btn secondary js-fill-amount" data-amount="<?php echo h(number_format($balance * 0.50, 2, '.', '')); ?>">50% of balance</button>
                <button type="button" class="btn secondary js-fill-amount" data-amount="<?php echo h(number_format($balance, 2, '.', '')); ?>">Full balance</button>
              </div>
            <?php endif; ?>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Available balance</strong><br>
              <?php echo money($balance); ?>
            </div>
            <div class="hero-note">
              <strong>Total withdrawals</strong><br>
              <?php echo money($withdrawals); ?>
            </div>
            <div class="hero-note">
              <strong>Last withdrawal</strong><br>
              <?php echo h(format_datetime($lastWithdrawal)); ?>
            </div>
          </div>
        </div>

        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>"><?php echo h($message); ?></div>
        <?php endif; ?>

        <div class="split">
          <div class="section">
            <h3>Enter Withdrawal</h3>
            <form method="POST">
              <?php echo csrf_field(); ?>
              <?php echo form_token_field('member_withdraw'); ?>
              <label for="amount">Amount</label>
              <input type="number" step="0.01" min="0.01" max="<?php echo h(number_format(max($balance, 0), 2, '.', '')); ?>" id="amount" name="amount" required>
              <button type="submit">Withdraw</button>
            </form>
            <p class="note">The system blocks withdrawals above your current balance and preserves history by posting transactions rather than editing prior rows.</p>
          </div>

          <div class="section">
            <h3>Current Status</h3>
            <div class="metric-list">
              <div class="metric-row">
                <div>
                  <div class="metric-label">Available for withdrawal</div>
                  <div class="metric-value"><?php echo money($balance); ?></div>
                </div>
                <div class="metric-value"><?php echo $balance > 0 ? 'Ready' : 'Zero balance'; ?></div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Balance protection</div>
                  <div class="metric-value">No overdrafts allowed</div>
                </div>
                <div class="metric-value">Active</div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Statement update</div>
                  <div class="metric-value">Posted immediately</div>
                </div>
                <div class="metric-value">Live</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Withdrawals</div>
      <div class="card-b">
        <?php if (!$recentWithdrawals): ?>
          <div class="empty-state">No withdrawals have been posted yet for this account.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Posted</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($recentWithdrawals as $withdrawal): ?>
                  <tr>
                    <td>#<?php echo (int)$withdrawal['id']; ?></td>
                    <td><?php echo money((float)$withdrawal['amount']); ?></td>
                    <td><?php echo h(format_datetime($withdrawal['created_at'] ?? null)); ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<script nonce="<?php echo h(csp_nonce()); ?>">
document.querySelectorAll('.js-fill-amount').forEach(function (button) {
  button.addEventListener('click', function () {
    var input = document.getElementById('amount');
    if (input) {
      input.value = button.getAttribute('data-amount');
      input.focus();
    }
  });
});
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
