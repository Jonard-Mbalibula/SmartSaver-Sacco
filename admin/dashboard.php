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

$deposits = (float)($totals['deposits'] ?? 0);
$withdrawals = (float)($totals['withdrawals'] ?? 0);
$netBalance = $deposits - $withdrawals;

$loanTotals = $pdo->query(
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

$loanRepaid = (float)($loanTotals['repaid'] ?? 0);
$loanOutstanding = (float)($loanTotals['outstanding'] ?? 0);
$membersCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='member'")->fetchColumn();
$pendingLoans = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='pending'")->fetchColumn();
$approvedLoans = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='approved'")->fetchColumn();
$closedLoans = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='closed'")->fetchColumn();
$rejectedLoans = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='rejected'")->fetchColumn();
$totalLoans = $pendingLoans + $approvedLoans + $closedLoans + $rejectedLoans;

$topSavers = $pdo->query(
    "SELECT u.user_id, u.full_name, u.phone,
            IFNULL(t.deposits, 0) AS deposits,
            IFNULL(t.withdrawals, 0) AS withdrawals,
            IFNULL(t.deposits, 0) - IFNULL(t.withdrawals, 0) AS balance,
            IFNULL(l.active_loans, 0) AS active_loans,
            IFNULL(l.outstanding, 0) AS loan_outstanding
     FROM users u
     LEFT JOIN (
        SELECT user_id,
               SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END) AS deposits,
               SUM(CASE WHEN type='withdraw' THEN amount ELSE 0 END) AS withdrawals
        FROM transactions
        GROUP BY user_id
     ) t ON t.user_id = u.user_id
     LEFT JOIN (
        SELECT x.user_id,
               SUM(CASE WHEN x.status = 'approved' THEN 1 ELSE 0 END) AS active_loans,
               SUM(CASE WHEN x.status = 'approved' THEN GREATEST(x.total_due - IFNULL(x.paid, 0), 0) ELSE 0 END) AS outstanding
        FROM (
            SELECT l.loan_id, l.user_id, l.status,
                   l.approved_amount + (l.approved_amount * l.interest_rate / 100) AS total_due,
                   IFNULL(r.paid, 0) AS paid
            FROM loans l
            LEFT JOIN (
                SELECT loan_id, SUM(amount) AS paid
                FROM loan_repayments
                GROUP BY loan_id
            ) r ON r.loan_id = l.loan_id
            WHERE l.approved_amount IS NOT NULL
              AND l.interest_rate IS NOT NULL
        ) x
        GROUP BY x.user_id
     ) l ON l.user_id = u.user_id
     WHERE u.role = 'member'
     ORDER BY balance DESC
     LIMIT 5"
)->fetchAll(PDO::FETCH_ASSOC);

$pendingQueue = $pdo->query(
    "SELECT l.loan_id, l.requested_amount, l.duration_months, l.created_at, u.full_name
     FROM loans l
     INNER JOIN users u ON u.user_id = l.user_id
     WHERE l.status = 'pending'
     ORDER BY l.created_at DESC
     LIMIT 5"
)->fetchAll(PDO::FETCH_ASSOC);

$recentTransactions = $pdo->query(
    "SELECT t.id, t.type, t.amount, t.created_at, u.full_name
     FROM transactions t
     INNER JOIN users u ON u.user_id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT 6"
)->fetchAll(PDO::FETCH_ASSOC);

$recentRepayments = $pdo->query(
    "SELECT r.repayment_id, r.loan_id, r.amount, u.full_name
     FROM loan_repayments r
     INNER JOIN loans l ON l.loan_id = r.loan_id
     INNER JOIN users u ON u.user_id = l.user_id
     ORDER BY r.repayment_id DESC
     LIMIT 6"
)->fetchAll(PDO::FETCH_ASSOC);

$title = 'Admin Dashboard';
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
            <h1>Admin Home</h1>
            <p>Review members, savings, loan requests, and loan payments from one place.</p>
            <div class="action-row">
              <a class="btn" href="/DSLT/admin/approve_loan.php">Review Loan Requests</a>
              <a class="btn secondary" href="/DSLT/admin/loan_payments.php">Receive Loan Payment</a>
              <a class="btn secondary" href="/DSLT/admin/members.php">Members</a>
              <a class="btn secondary" href="/DSLT/admin/reports.php">Reports</a>
            </div>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Members</strong><br>
              <?php echo $membersCount; ?> active member records
            </div>
            <div class="hero-note">
              <strong>Loan outstanding</strong><br>
              <?php echo money($loanOutstanding); ?>
            </div>
            <div class="hero-note">
              <strong>Total savings balance</strong><br>
              <?php echo money($netBalance); ?>
            </div>
            <div class="hero-note">
              <strong>Loans tracked</strong><br>
              <?php echo $totalLoans; ?> loan records
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="label">Members</div><div class="value"><?php echo $membersCount; ?></div><div class="subvalue">Registered member accounts</div></div>
          <div class="kpi"><div class="label">Total Deposits</div><div class="value"><?php echo money($deposits); ?></div><div class="subvalue">Savings received</div></div>
          <div class="kpi"><div class="label">Total Withdrawals</div><div class="value"><?php echo money($withdrawals); ?></div><div class="subvalue">Savings paid out</div></div>
          <div class="kpi"><div class="label">Savings Balance</div><div class="value"><?php echo money($netBalance); ?></div><div class="subvalue">Deposits less withdrawals</div></div>
          <div class="kpi"><div class="label">Pending Loans</div><div class="value"><?php echo $pendingLoans; ?></div><div class="subvalue">Awaiting decision</div></div>
          <div class="kpi"><div class="label">Approved Loans</div><div class="value"><?php echo $approvedLoans; ?></div><div class="subvalue">Currently active</div></div>
          <div class="kpi"><div class="label">Closed Loans</div><div class="value"><?php echo $closedLoans; ?></div><div class="subvalue">Fully paid loans</div></div>
          <div class="kpi"><div class="label">Loan Total Due</div><div class="value"><?php echo money((float)($loanTotals['total_due'] ?? 0)); ?></div><div class="subvalue">Principal plus interest</div></div>
          <div class="kpi"><div class="label">Loan Repaid</div><div class="value"><?php echo money($loanRepaid); ?></div><div class="subvalue">All repayment entries</div></div>
          <div class="kpi"><div class="label">Loan Outstanding</div><div class="value"><?php echo money($loanOutstanding); ?></div><div class="subvalue">Active approved balances</div></div>
          <div class="kpi"><div class="label">Loan Interest</div><div class="value"><?php echo money((float)($loanTotals['interest_due'] ?? 0)); ?></div><div class="subvalue">Interest on approved/closed loans</div></div>
          <div class="kpi"><div class="label">Rejected Loans</div><div class="value"><?php echo $rejectedLoans; ?></div><div class="subvalue">Declined applications</div></div>
        </div>

        <div class="split">
          <div class="section">
            <div class="section-head">
              <h3>Savings Overview</h3>
              <span class="muted">Deposits vs withdrawals</span>
            </div>
            <div class="chart-holder">
              <canvas id="adminSavingsPie" height="220"></canvas>
            </div>
          </div>
          <div class="section">
            <div class="section-head">
              <h3>Loan Portfolio</h3>
              <span class="muted">Status breakdown</span>
            </div>
            <div class="chart-holder">
              <canvas id="adminLoanPie" height="220"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-h">Pending Loan Requests</div>
        <div class="card-b">
          <?php if (!$pendingQueue): ?>
            <div class="empty-state">There are no pending loan applications right now.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Loan</th>
                    <th>Member</th>
                    <th>Requested</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($pendingQueue as $loan): ?>
                    <tr>
                      <td>#<?php echo (int)$loan['loan_id']; ?> / <?php echo (int)$loan['duration_months']; ?> months</td>
                      <td><?php echo h($loan['full_name']); ?></td>
                      <td><?php echo money((float)$loan['requested_amount']); ?></td>
                      <td><?php echo h(format_datetime($loan['created_at'] ?? null)); ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
            <p class="note"><a href="/DSLT/admin/approve_loan.php">View all loan requests</a></p>
          <?php endif; ?>
        </div>
      </div>

      <div class="card">
        <div class="card-h">Top Savers</div>
        <div class="card-b">
          <?php if (!$topSavers): ?>
            <div class="empty-state">No member savings data is available yet.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Balance</th>
                    <th>Loan Due</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($topSavers as $member): ?>
                    <tr>
                      <td><?php echo h($member['full_name']); ?><div class="note"><?php echo h($member['phone']); ?></div></td>
                      <td><?php echo money((float)$member['balance']); ?></td>
                      <td><?php echo money((float)$member['loan_outstanding']); ?><div class="note"><?php echo (int)$member['active_loans']; ?> active loans</div></td>
                      <td><a href="/DSLT/admin/members_view.php?user_id=<?php echo (int)$member['user_id']; ?>">View Profile</a></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endif; ?>
          <p class="note">Wrong savings entries should be reversed so the history stays clear.</p>
        </div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-h">Latest Savings Entries</div>
        <div class="card-b">
          <?php if (!$recentTransactions): ?>
            <div class="empty-state">No savings transactions have been recorded yet.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($recentTransactions as $transaction): ?>
                    <tr>
                      <td>#<?php echo (int)$transaction['id']; ?></td>
                      <td><?php echo h($transaction['full_name']); ?><div class="note"><?php echo h(format_datetime($transaction['created_at'] ?? null)); ?></div></td>
                      <td><span class="status <?php echo h(transaction_class((string)$transaction['type'])); ?>"><?php echo h(ucfirst((string)$transaction['type'])); ?></span></td>
                      <td><?php echo money((float)$transaction['amount']); ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="card">
        <div class="card-h">Latest Loan Payments</div>
        <div class="card-b">
          <?php if (!$recentRepayments): ?>
            <div class="empty-state">No loan repayments have been recorded yet.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Loan</th>
                    <th>Member</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($recentRepayments as $repayment): ?>
                    <tr>
                      <td>#<?php echo (int)$repayment['repayment_id']; ?></td>
                      <td>#<?php echo (int)$repayment['loan_id']; ?></td>
                      <td><?php echo h($repayment['full_name']); ?></td>
                      <td><?php echo money((float)$repayment['amount']); ?></td>
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
</div>

<script nonce="<?php echo h(csp_nonce()); ?>">
(async function () {
  const currency = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const response = await fetch('/DSLT/api/admin_stats.php');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const theme = getComputedStyle(document.body);
  const accent = theme.getPropertyValue('--accent').trim() || '#1f5fae';
  const danger = theme.getPropertyValue('--danger').trim() || '#c74d4d';

  const savingsCanvas = document.getElementById('adminSavingsPie');
  if (savingsCanvas) {
    new Chart(savingsCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Deposits', 'Withdrawals'],
        datasets: [{
          data: [Number(data.deposits || 0), Number(data.withdrawals || 0)],
          backgroundColor: [accent, danger],
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.label + ': ' + currency.format(context.parsed || 0);
              }
            }
          }
        }
      }
    });
  }

  const loanCanvas = document.getElementById('adminLoanPie');
  if (loanCanvas && Array.isArray(data.loan_status_labels)) {
    const labels = data.loan_status_labels.map(function (status) {
      return status.charAt(0).toUpperCase() + status.slice(1);
    });
    new Chart(loanCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Loans',
          data: data.loan_status_counts || [],
          backgroundColor: accent,
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }
})();
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
