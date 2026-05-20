<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (($_SESSION['role'] ?? '') !== 'member') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];

$stmt = $pdo->prepare(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals,
        COUNT(*) AS transaction_count,
        MAX(created_at) AS last_activity
     FROM transactions
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

$deposits = (float)($summary['deposits'] ?? 0);
$withdrawals = (float)($summary['withdrawals'] ?? 0);
$balance = $deposits - $withdrawals;
$transactionCount = (int)($summary['transaction_count'] ?? 0);
$lastActivity = $summary['last_activity'] ?? null;

$stmt = $pdo->prepare(
    "SELECT id, type, amount, created_at, is_reversal, reversed_transaction_id
     FROM transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 30"
);
$stmt->execute([$userId]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare(
    "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_label,
            IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
            IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
     FROM transactions
     WHERE user_id = ?
       AND created_at >= (CURDATE() - INTERVAL 6 MONTH)
     GROUP BY month_label
     ORDER BY month_label"
);
$stmt->execute([$userId]);
$monthlyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$chartLabels = array_map(static fn(array $row): string => (string)$row['month_label'], $monthlyRows);
$chartDeposits = array_map(static fn(array $row): float => (float)$row['deposits'], $monthlyRows);
$chartWithdrawals = array_map(static fn(array $row): float => (float)$row['withdrawals'], $monthlyRows);

$title = 'Statement';
$include_chartjs = true;
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
            <h1>Statement</h1>
            <p>See your savings balance and all recent money movements.</p>
            <div class="action-row">
              <a class="btn" href="/DSLT/savings/deposit.php">Save or Pay Loan</a>
              <a class="btn secondary" href="/DSLT/savings/withdraw.php">Withdraw</a>
            </div>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Savings balance</strong><br>
              <?php echo money($balance); ?>
            </div>
            <div class="hero-note">
              <strong>Total movements</strong><br>
              <?php echo (int)$transactionCount; ?> posted transactions
            </div>
            <div class="hero-note">
              <strong>Last posting date</strong><br>
              <?php echo h(format_datetime($lastActivity)); ?>
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <div class="label">Savings Balance</div>
            <div class="value"><?php echo money($balance); ?></div>
            <div class="subvalue">Deposits less withdrawals</div>
          </div>
          <div class="kpi">
            <div class="label">Total Deposits</div>
            <div class="value"><?php echo money($deposits); ?></div>
            <div class="subvalue">All deposit transactions on record</div>
          </div>
          <div class="kpi">
            <div class="label">Total Withdrawals</div>
            <div class="value"><?php echo money($withdrawals); ?></div>
            <div class="subvalue">All withdrawals including reversals</div>
          </div>
          <div class="kpi">
            <div class="label">Entries</div>
            <div class="value"><?php echo (int)$transactionCount; ?></div>
            <div class="subvalue">Posted savings entries</div>
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <h3>Monthly Savings</h3>
            <span class="muted">Last 6 months</span>
          </div>
          <canvas id="monthlySavingsFlow" height="120"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Entries</div>
      <div class="card-b">
        <?php if (!$transactions): ?>
          <div class="empty-state">No transaction history is available yet for this account.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Posted</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($transactions as $transaction): ?>
                  <tr>
                    <td>#<?php echo (int)$transaction['id']; ?></td>
                    <td>
                      <span class="status <?php echo h(transaction_class((string)$transaction['type'], (int)$transaction['is_reversal'])); ?>">
                        <?php echo h(ucfirst((string)$transaction['type'])); ?>
                        <?php if ((int)$transaction['is_reversal'] === 1): ?> reversal<?php endif; ?>
                      </span>
                    </td>
                    <td><?php echo money((float)$transaction['amount']); ?></td>
                    <td><?php echo h(format_datetime($transaction['created_at'] ?? null)); ?></td>
                    <td>
                      <?php if (!empty($transaction['reversed_transaction_id'])): ?>
                        Reverses transaction #<?php echo (int)$transaction['reversed_transaction_id']; ?>
                      <?php else: ?>
                        Normal entry
                      <?php endif; ?>
                    </td>
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
new Chart(document.getElementById('monthlySavingsFlow'), {
  type: 'bar',
  data: {
    labels: <?php echo json_encode($chartLabels); ?>,
    datasets: [
      {
        label: 'Deposits',
        data: <?php echo json_encode($chartDeposits); ?>,
        backgroundColor: '#0d6b53'
      },
      {
        label: 'Withdrawals',
        data: <?php echo json_encode($chartWithdrawals); ?>,
        backgroundColor: '#c74d4d'
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  }
});
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
