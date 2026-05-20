<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'member') {
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
$savings = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

$deposits = (float)($savings['deposits'] ?? 0);
$withdrawals = (float)($savings['withdrawals'] ?? 0);
$balance = $deposits - $withdrawals;
$transactionCount = (int)($savings['transaction_count'] ?? 0);
$lastActivity = $savings['last_activity'] ?? null;

$stmt = $pdo->prepare(
    "SELECT
        COUNT(*) AS total_loans,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_loans,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS active_loans,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_loans,
        IFNULL(SUM(CASE WHEN status IN ('approved', 'closed') THEN approved_amount + (approved_amount * interest_rate / 100) END), 0) AS total_due
     FROM loans
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$loanSummary = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

$stmt = $pdo->prepare(
    "SELECT IFNULL(SUM(r.amount), 0)
     FROM loan_repayments r
     INNER JOIN loans l ON l.loan_id = r.loan_id
     WHERE l.user_id = ?"
);
$stmt->execute([$userId]);
$totalRepaid = (float)$stmt->fetchColumn();
$totalLoanDue = (float)($loanSummary['total_due'] ?? 0);
$loanOutstanding = max($totalLoanDue - $totalRepaid, 0);

$stmt = $pdo->prepare(
    "SELECT id, type, amount, created_at, is_reversal, reversed_transaction_id
     FROM transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 6"
);
$stmt->execute([$userId]);
$recentTransactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare(
    "SELECT loan_id, requested_amount, approved_amount, duration_months, interest_rate, status, start_date, created_at
     FROM loans
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 4"
);
$stmt->execute([$userId]);
$recentLoans = $stmt->fetchAll(PDO::FETCH_ASSOC);

$savingsRate = $deposits > 0 ? (($balance / $deposits) * 100) : 0;
$title = 'Member Dashboard';
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
            <h1>Welcome, <?php echo h($_SESSION['name'] ?? 'Member'); ?></h1>
            <p>See your money, your loans, and the next action you may need.</p>
            <div class="action-row">
              <a class="btn" href="/DSLT/savings/deposit.php">Save or Pay Loan</a>
              <a class="btn secondary" href="/DSLT/savings/withdraw.php">Withdraw</a>
              <a class="btn secondary" href="/DSLT/loans/loan_request.php">Apply Loan</a>
            </div>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Savings balance</strong><br>
              <?php echo money($balance); ?>
            </div>
            <div class="hero-note">
              <strong>Last account activity</strong><br>
              <?php echo h(format_datetime($lastActivity)); ?>
            </div>
            <div class="hero-note">
              <strong>Loan balance</strong><br>
              <?php echo money($loanOutstanding); ?>
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <div class="label">Savings Balance</div>
            <div class="value"><?php echo money($balance); ?></div>
            <div class="subvalue">Money currently in savings</div>
          </div>
          <div class="kpi">
            <div class="label">Total Deposits</div>
            <div class="value"><?php echo money($deposits); ?></div>
            <div class="subvalue">Money added to savings</div>
          </div>
          <div class="kpi">
            <div class="label">Total Withdrawals</div>
            <div class="value"><?php echo money($withdrawals); ?></div>
            <div class="subvalue">Money taken from savings</div>
          </div>
          <div class="kpi">
            <div class="label">Loan Outstanding</div>
            <div class="value"><?php echo money($loanOutstanding); ?></div>
            <div class="subvalue">Amount still to pay</div>
          </div>
          <div class="kpi">
            <div class="label">Entries</div>
            <div class="value"><?php echo (int)$transactionCount; ?></div>
            <div class="subvalue">Savings entries recorded</div>
          </div>
          <div class="kpi">
            <div class="label">Pending Loans</div>
            <div class="value"><?php echo (int)($loanSummary['pending_loans'] ?? 0); ?></div>
            <div class="subvalue">Applications awaiting review</div>
          </div>
          <div class="kpi">
            <div class="label">Total Repaid</div>
            <div class="value"><?php echo money($totalRepaid); ?></div>
            <div class="subvalue">Amount paid across all loans</div>
          </div>
          <div class="kpi">
            <div class="label">Savings Retention</div>
            <div class="value"><?php echo number_format(max($savingsRate, 0), 1); ?>%</div>
            <div class="subvalue">Balance retained from deposits</div>
          </div>
        </div>

        <div class="split">
          <div class="section">
            <div class="section-head">
              <h3>Savings Mix</h3>
              <span class="muted">Deposits vs withdrawals</span>
            </div>
            <canvas id="savingsPie" height="220"></canvas>
          </div>
          <div class="section">
            <div class="section-head">
              <h3>Deposit Trend</h3>
              <span class="muted">Last 7 days</span>
            </div>
            <canvas id="savingsTrend" height="220"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-h">Recent Savings</div>
        <div class="card-b">
          <?php if (!$recentTransactions): ?>
            <div class="empty-state">No transactions have been posted yet. Start with your first deposit.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Posted</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($recentTransactions as $transaction): ?>
                    <tr>
                      <td>
                        <span class="status <?php echo h(transaction_class((string)$transaction['type'], (int)$transaction['is_reversal'])); ?>">
                          <?php echo h(ucfirst((string)$transaction['type'])); ?>
                          <?php if ((int)$transaction['is_reversal'] === 1): ?> reversal<?php endif; ?>
                        </span>
                        <?php if (!empty($transaction['reversed_transaction_id'])): ?>
                          <div class="note">Linked to transaction #<?php echo (int)$transaction['reversed_transaction_id']; ?></div>
                        <?php endif; ?>
                      </td>
                      <td><?php echo h(format_datetime($transaction['created_at'] ?? null)); ?></td>
                      <td><?php echo money((float)$transaction['amount']); ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endif; ?>
          <p class="note"><a href="/DSLT/savings/balance.php">View full statement</a></p>
        </div>
      </div>

      <div class="card">
        <div class="card-h">Recent Loans</div>
        <div class="card-b">
          <?php if (!$recentLoans): ?>
            <div class="empty-state">You do not have loan records yet. Loan requests will appear here once submitted.</div>
          <?php else: ?>
            <div class="list">
              <?php foreach ($recentLoans as $loan): ?>
                <?php
                  $approvedAmount = (float)($loan['approved_amount'] ?? 0);
                  $rate = (float)($loan['interest_rate'] ?? 0);
                  $status = (string)($loan['status'] ?? 'pending');
                  $loanTotal = $approvedAmount > 0 ? $approvedAmount + ($approvedAmount * $rate / 100) : 0;
                ?>
                <div class="list-item">
                  <div>
                    <strong>Loan #<?php echo (int)$loan['loan_id']; ?></strong>
                    <div class="note">Requested <?php echo money((float)$loan['requested_amount']); ?> for <?php echo (int)$loan['duration_months']; ?> months</div>
                    <div class="note">Submitted <?php echo h(format_datetime($loan['created_at'] ?? null)); ?></div>
                  </div>
                  <div>
                    <div><span class="status <?php echo h(loan_status_class($status)); ?>"><?php echo h(ucfirst($status)); ?></span></div>
                    <div class="note"><?php echo $loanTotal > 0 ? 'Approved total due: ' . money($loanTotal) : 'Awaiting review'; ?></div>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
          <p class="note"><a href="/DSLT/loans/loan_status.php">View all loans</a></p>
        </div>
      </div>
    </div>
  </div>
</div>

<script nonce="<?php echo h(csp_nonce()); ?>">
(async function () {
  const currency = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const response = await fetch('/DSLT/api/member_stats.php');
  const data = await response.json();

  new Chart(document.getElementById('savingsPie'), {
    type: 'doughnut',
    data: {
      labels: ['Deposits', 'Withdrawals'],
      datasets: [{
        data: [Number(data.deposits || 0), Number(data.withdrawals || 0)],
        backgroundColor: ['#0d6b53', '#c74d4d'],
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

  new Chart(document.getElementById('savingsTrend'), {
    type: 'line',
    data: {
      labels: data.trend_days,
      datasets: [{
        label: 'Daily deposits',
        data: data.trend_values,
        borderColor: '#0d6b53',
        backgroundColor: 'rgba(13,107,83,0.12)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return currency.format(value);
            }
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
})();
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
