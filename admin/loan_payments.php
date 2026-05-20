<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/app_helpers.php';

csrf_init();

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$flashMessage = $_SESSION['flash_message'] ?? '';
$flashType = $_SESSION['flash_type'] ?? 'ok';
unset($_SESSION['flash_message'], $_SESSION['flash_type']);

$loans = $pdo->query(
    "SELECT l.loan_id, l.user_id, l.requested_amount, l.approved_amount, l.interest_rate,
            l.duration_months, l.start_date, l.created_at, u.full_name, u.phone,
            IFNULL(SUM(r.amount), 0) AS paid,
            COUNT(r.repayment_id) AS repayment_count
     FROM loans l
     INNER JOIN users u ON u.user_id = l.user_id
     LEFT JOIN loan_repayments r ON r.loan_id = l.loan_id
     WHERE l.status = 'approved'
       AND l.approved_amount IS NOT NULL
       AND l.interest_rate IS NOT NULL
     GROUP BY l.loan_id, l.user_id, l.requested_amount, l.approved_amount, l.interest_rate,
              l.duration_months, l.start_date, l.created_at, u.full_name, u.phone
     ORDER BY l.created_at DESC"
)->fetchAll(PDO::FETCH_ASSOC);

$recentRepayments = $pdo->query(
    "SELECT r.repayment_id, r.loan_id, r.amount, u.full_name, u.phone
     FROM loan_repayments r
     INNER JOIN loans l ON l.loan_id = r.loan_id
     INNER JOIN users u ON u.user_id = l.user_id
     ORDER BY r.repayment_id DESC
     LIMIT 15"
)->fetchAll(PDO::FETCH_ASSOC);

$summary = [
    'active' => 0,
    'total_due' => 0.0,
    'paid' => 0.0,
    'outstanding' => 0.0,
];
$payableLoans = [];

foreach ($loans as $loan) {
    $approvedAmount = (float)$loan['approved_amount'];
    $interestRate = (float)$loan['interest_rate'];
    $totalDue = $approvedAmount + ($approvedAmount * $interestRate / 100);
    $paid = (float)$loan['paid'];
    $balanceRemaining = max($totalDue - $paid, 0);

    $summary['total_due'] += $totalDue;
    $summary['paid'] += $paid;
    $summary['outstanding'] += $balanceRemaining;

    if ($balanceRemaining > 0) {
        $loan['total_due'] = $totalDue;
        $loan['balance_remaining'] = $balanceRemaining;
        $payableLoans[] = $loan;
    }
}
$summary['active'] = count($payableLoans);

$title = 'Loan Payments';
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
            <h1>Receive Loan Payment</h1>
            <p>Choose an active loan, enter the amount received, and the balance will reduce automatically.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Active loans</strong><br>
              <?php echo (int)$summary['active']; ?> approved facilities
            </div>
            <div class="hero-note">
              <strong>Outstanding balance</strong><br>
              <?php echo money((float)$summary['outstanding']); ?>
            </div>
            <div class="hero-note">
              <strong>Total repaid</strong><br>
              <?php echo money((float)$summary['paid']); ?>
            </div>
          </div>
        </div>

        <?php if ($flashMessage !== ''): ?>
          <div class="alert <?php echo h($flashType); ?>"><?php echo h($flashMessage); ?></div>
        <?php endif; ?>

        <div class="kpis">
          <div class="kpi"><div class="label">Active Loans</div><div class="value"><?php echo (int)$summary['active']; ?></div><div class="subvalue">Available for payment posting</div></div>
          <div class="kpi"><div class="label">Total Due</div><div class="value"><?php echo money((float)$summary['total_due']); ?></div><div class="subvalue">Principal plus interest</div></div>
          <div class="kpi"><div class="label">Paid</div><div class="value"><?php echo money((float)$summary['paid']); ?></div><div class="subvalue">Loan payments already recorded</div></div>
          <div class="kpi"><div class="label">Outstanding</div><div class="value"><?php echo money((float)$summary['outstanding']); ?></div><div class="subvalue">Remaining approved balances</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Active Loans To Pay</div>
      <div class="card-b">
        <?php if (!$payableLoans): ?>
          <div class="empty-state">No approved loans currently need repayments.</div>
        <?php else: ?>
          <?php foreach ($payableLoans as $loan): ?>
            <?php
              $loanId = (int)$loan['loan_id'];
              $approvedAmount = (float)$loan['approved_amount'];
              $interestRate = (float)$loan['interest_rate'];
              $totalDue = (float)$loan['total_due'];
              $paid = (float)$loan['paid'];
              $balanceRemaining = (float)$loan['balance_remaining'];
            ?>
            <div class="section">
              <div class="section-head">
                <h3>Loan #<?php echo $loanId; ?> - <?php echo h($loan['full_name']); ?></h3>
                <span class="status status-good">Approved</span>
              </div>

              <div class="split">
                <div>
                  <div class="metric-list">
                    <div class="metric-row"><span class="metric-label">Member phone</span><span class="metric-value"><?php echo h($loan['phone']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Requested amount</span><span class="metric-value"><?php echo money((float)$loan['requested_amount']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Approved amount</span><span class="metric-value"><?php echo money($approvedAmount); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Interest rate</span><span class="metric-value"><?php echo money($interestRate); ?>%</span></div>
                    <div class="metric-row"><span class="metric-label">Start date</span><span class="metric-value"><?php echo h(format_date($loan['start_date'] ?? null)); ?></span></div>
                  </div>
                </div>

                <div>
                  <div class="metric-list">
                    <div class="metric-row"><span class="metric-label">Total due</span><span class="metric-value"><?php echo money($totalDue); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Paid so far</span><span class="metric-value"><?php echo money($paid); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Balance remaining</span><span class="metric-value"><?php echo money($balanceRemaining); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Payment count</span><span class="metric-value"><?php echo (int)$loan['repayment_count']; ?></span></div>
                  </div>

                  <form method="POST" action="/DSLT/loans/repay_loan.php" class="loan-payment-form" data-balance="<?php echo h(number_format($balanceRemaining, 2, '.', '')); ?>">
                    <?php echo csrf_field(); ?>
                    <input type="hidden" name="loan_id" value="<?php echo $loanId; ?>">
                    <label for="admin_amount_<?php echo $loanId; ?>">Payment Amount</label>
                    <input type="number" step="0.01" min="0.01" max="<?php echo h(number_format($balanceRemaining, 2, '.', '')); ?>" id="admin_amount_<?php echo $loanId; ?>" name="amount" data-payment-amount required>
                    <div class="form-feedback" data-payment-preview>Remaining after payment: <?php echo money($balanceRemaining); ?></div>
                    <button type="submit">Record Payment</button>
                  </form>
                </div>
              </div>
            </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Loan Payments</div>
      <div class="card-b">
        <?php if (!$recentRepayments): ?>
          <div class="empty-state">No loan payments have been recorded yet.</div>
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
                    <td><?php echo h($repayment['full_name']); ?><div class="note"><?php echo h($repayment['phone']); ?></div></td>
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

<script src="/DSLT/assets/js/loan-payments.js"></script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
