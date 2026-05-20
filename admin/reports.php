<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$totals = $pdo->query(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
     FROM transactions"
)->fetch(PDO::FETCH_ASSOC) ?: [];

$net = (float)($totals['deposits'] ?? 0) - (float)($totals['withdrawals'] ?? 0);
$memberCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='member'")->fetchColumn();
$loanSummary = $pdo->query(
    "SELECT
        IFNULL(SUM(CASE WHEN l.status IN ('approved', 'closed') THEN l.approved_amount ELSE 0 END), 0) AS principal,
        IFNULL(SUM(CASE WHEN l.status IN ('approved', 'closed') THEN l.approved_amount * l.interest_rate / 100 ELSE 0 END), 0) AS interest_due,
        IFNULL(SUM(CASE WHEN l.status IN ('approved', 'closed') THEN l.approved_amount + (l.approved_amount * l.interest_rate / 100) ELSE 0 END), 0) AS total_due,
        IFNULL(SUM(CASE WHEN l.status IN ('approved', 'closed') THEN IFNULL(r.paid, 0) ELSE 0 END), 0) AS repaid,
        IFNULL(SUM(CASE WHEN l.status = 'approved' THEN GREATEST((l.approved_amount + (l.approved_amount * l.interest_rate / 100)) - IFNULL(r.paid, 0), 0) ELSE 0 END), 0) AS outstanding
     FROM loans l
     LEFT JOIN (
        SELECT loan_id, SUM(amount) AS paid
        FROM loan_repayments
        GROUP BY loan_id
     ) r ON r.loan_id = l.loan_id
     WHERE l.approved_amount IS NOT NULL
       AND l.interest_rate IS NOT NULL"
)->fetch(PDO::FETCH_ASSOC) ?: [];
$loanInterest = (float)($loanSummary['interest_due'] ?? 0);
$loanOutstanding = (float)($loanSummary['outstanding'] ?? 0);
$loanRepaid = (float)($loanSummary['repaid'] ?? 0);

$monthlyRows = $pdo->query(
    "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_label,
            IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
            IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
     FROM transactions
     WHERE created_at >= (CURDATE() - INTERVAL 6 MONTH)
     GROUP BY month_label
     ORDER BY month_label"
)->fetchAll(PDO::FETCH_ASSOC);
$labels = array_map(static fn(array $row): string => (string)$row['month_label'], $monthlyRows);
$depositSeries = array_map(static fn(array $row): float => (float)$row['deposits'], $monthlyRows);
$withdrawalSeries = array_map(static fn(array $row): float => (float)$row['withdrawals'], $monthlyRows);

$loanRows = $pdo->query(
    "SELECT status, COUNT(*) AS total
     FROM loans
     GROUP BY status"
)->fetchAll(PDO::FETCH_ASSOC);
$loanLabels = array_map(static fn(array $row): string => ucfirst((string)$row['status']), $loanRows);
$loanCounts = array_map(static fn(array $row): int => (int)$row['total'], $loanRows);

$topSavers = $pdo->query(
    "SELECT u.user_id, u.full_name, u.phone,
            IFNULL(SUM(CASE WHEN t.type='deposit' THEN t.amount END), 0) - IFNULL(SUM(CASE WHEN t.type='withdraw' THEN t.amount END), 0) AS balance
     FROM users u
     LEFT JOIN transactions t ON t.user_id = u.user_id
     WHERE u.role = 'member'
     GROUP BY u.user_id, u.full_name, u.phone
     ORDER BY balance DESC
     LIMIT 10"
)->fetchAll(PDO::FETCH_ASSOC);

$title = 'Admin Reports';
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
            <h1>Reports</h1>
            <p>View savings totals, loan totals, and member balances from the current records.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Members</strong><br>
              <?php echo $memberCount; ?> members tracked
            </div>
            <div class="hero-note">
              <strong>Net savings position</strong><br>
              <?php echo money($net); ?>
            </div>
            <div class="hero-note">
              <strong>Total loan interest due</strong><br>
              <?php echo money($loanInterest); ?>
            </div>
            <div class="hero-note">
              <strong>Loan outstanding</strong><br>
              <?php echo money($loanOutstanding); ?>
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="label">Total Deposits</div><div class="value"><?php echo money((float)($totals['deposits'] ?? 0)); ?></div><div class="subvalue">Cash received into savings</div></div>
          <div class="kpi"><div class="label">Total Withdrawals</div><div class="value"><?php echo money((float)($totals['withdrawals'] ?? 0)); ?></div><div class="subvalue">Cash paid out from savings</div></div>
          <div class="kpi"><div class="label">Net Balance</div><div class="value"><?php echo money($net); ?></div><div class="subvalue">Overall member savings position</div></div>
          <div class="kpi"><div class="label">Loan Principal</div><div class="value"><?php echo money((float)($loanSummary['principal'] ?? 0)); ?></div><div class="subvalue">Approved and closed principal</div></div>
          <div class="kpi"><div class="label">Loan Paid</div><div class="value"><?php echo money($loanRepaid); ?></div><div class="subvalue">Loan payments recorded</div></div>
          <div class="kpi"><div class="label">Loan Outstanding</div><div class="value"><?php echo money($loanOutstanding); ?></div><div class="subvalue">Active unpaid loan balances</div></div>
          <div class="kpi"><div class="label">Loan Interest</div><div class="value"><?php echo money($loanInterest); ?></div><div class="subvalue">Interest expected on approved loans</div></div>
        </div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-h">Monthly Savings Flow</div>
        <div class="card-b">
          <canvas id="monthlyFlow" height="220"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-h">Loans by Status</div>
        <div class="card-b">
          <canvas id="loansByStatus" height="220"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Top Savers</div>
      <div class="card-b">
        <?php if (!$topSavers): ?>
          <div class="empty-state">No saver rankings are available yet.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Net Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($topSavers as $member): ?>
                  <tr>
                    <td><?php echo h($member['full_name']); ?></td>
                    <td><?php echo h($member['phone']); ?></td>
                    <td><?php echo money((float)$member['balance']); ?></td>
                    <td><a href="/DSLT/admin/members_view.php?user_id=<?php echo (int)$member['user_id']; ?>">View</a></td>
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
new Chart(document.getElementById('monthlyFlow'), {
  type: 'line',
  data: {
    labels: <?php echo json_encode($labels); ?>,
    datasets: [
      {
        label: 'Deposits',
        data: <?php echo json_encode($depositSeries); ?>,
        borderColor: '#0d6b53',
        backgroundColor: 'rgba(13,107,83,0.12)',
        fill: true,
        tension: 0.28
      },
      {
        label: 'Withdrawals',
        data: <?php echo json_encode($withdrawalSeries); ?>,
        borderColor: '#c74d4d',
        backgroundColor: 'rgba(199,77,77,0.08)',
        fill: true,
        tension: 0.28
      }
    ]
  },
  options: {
    plugins: {
      legend: { position: 'bottom' }
    }
  }
});

new Chart(document.getElementById('loansByStatus'), {
  type: 'doughnut',
  data: {
    labels: <?php echo json_encode($loanLabels); ?>,
    datasets: [{
      data: <?php echo json_encode($loanCounts); ?>,
      backgroundColor: ['#d2a12e', '#0d6b53', '#c74d4d', '#85998f']
    }]
  },
  options: {
    plugins: {
      legend: { position: 'bottom' }
    }
  }
});
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
