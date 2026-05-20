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
$flashMessage = $_SESSION['flash_message'] ?? '';
$flashType = $_SESSION['flash_type'] ?? 'ok';
unset($_SESSION['flash_message'], $_SESSION['flash_type']);

$stmt = $pdo->prepare(
    "SELECT loan_id, requested_amount, approved_amount, interest_rate, duration_months, status, start_date, created_at
     FROM loans
     WHERE user_id = ?
     ORDER BY created_at DESC"
);
$stmt->execute([$userId]);
$loans = $stmt->fetchAll(PDO::FETCH_ASSOC);

$repaymentTotals = [];
if ($loans) {
    $loanIds = array_map(static fn(array $loan): int => (int)$loan['loan_id'], $loans);
    $placeholders = implode(',', array_fill(0, count($loanIds), '?'));
    $stmt = $pdo->prepare(
        "SELECT loan_id, COUNT(*) AS repayment_count, IFNULL(SUM(amount), 0) AS paid
         FROM loan_repayments
         WHERE loan_id IN ($placeholders)
         GROUP BY loan_id"
    );
    $stmt->execute($loanIds);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $repaymentTotals[(int)$row['loan_id']] = [
            'count' => (int)$row['repayment_count'],
            'paid' => (float)$row['paid'],
        ];
    }
}

$portfolio = [
    'pending' => 0,
    'approved' => 0,
    'closed' => 0,
    'rejected' => 0,
    'outstanding' => 0.0,
    'repaid' => 0.0,
];

foreach ($loans as $loan) {
    $status = (string)($loan['status'] ?? 'pending');
    if (isset($portfolio[$status])) {
        $portfolio[$status]++;
    }

    $approvedAmount = (float)($loan['approved_amount'] ?? 0);
    $interestRate = (float)($loan['interest_rate'] ?? 0);
    $totalDue = $approvedAmount > 0 ? $approvedAmount + ($approvedAmount * $interestRate / 100) : 0;
    $paid = (float)($repaymentTotals[(int)$loan['loan_id']]['paid'] ?? 0);
    $portfolio['repaid'] += $paid;
    $portfolio['outstanding'] += max($totalDue - $paid, 0);
}

$title = 'My Loans';
$page_section = 'My Loans';
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
            <h1>My Loans</h1>
            <p>Check loan requests, active loans, payments made, and balances still to pay.</p>
            <div class="action-row">
              <a class="btn" href="/DSLT/loans/loan_request.php">Apply Loan</a>
            </div>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Still to pay</strong><br>
              <?php echo money((float)$portfolio['outstanding']); ?>
            </div>
            <div class="hero-note">
              <strong>Total repaid</strong><br>
              <?php echo money((float)$portfolio['repaid']); ?>
            </div>
            <div class="hero-note">
              <strong>Total loan records</strong><br>
              <?php echo count($loans); ?> loan records
            </div>
          </div>
        </div>

        <?php if ($flashMessage !== ''): ?>
          <div class="alert <?php echo h($flashType); ?>"><?php echo h($flashMessage); ?></div>
        <?php endif; ?>

        <div class="kpis">
          <div class="kpi">
            <div class="label">Pending</div>
            <div class="value"><?php echo (int)$portfolio['pending']; ?></div>
            <div class="subvalue">Awaiting administrator review</div>
          </div>
          <div class="kpi">
            <div class="label">Approved</div>
            <div class="value"><?php echo (int)$portfolio['approved']; ?></div>
            <div class="subvalue">Currently active facilities</div>
          </div>
          <div class="kpi">
            <div class="label">Closed</div>
            <div class="value"><?php echo (int)$portfolio['closed']; ?></div>
            <div class="subvalue">Fully repaid facilities</div>
          </div>
          <div class="kpi">
            <div class="label">Outstanding</div>
            <div class="value"><?php echo money((float)$portfolio['outstanding']); ?></div>
            <div class="subvalue">Amount still to be paid</div>
          </div>
          <div class="kpi">
            <div class="label">Rejected</div>
            <div class="value"><?php echo (int)$portfolio['rejected']; ?></div>
            <div class="subvalue">Applications declined</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Loan List</div>
      <div class="card-b">
        <?php if (!$loans): ?>
          <div class="empty-state">You do not have any loan records yet.</div>
        <?php else: ?>
          <?php foreach ($loans as $loan): ?>
            <?php
              $loanId = (int)$loan['loan_id'];
              $status = (string)($loan['status'] ?? 'pending');
              $approvedAmount = (float)($loan['approved_amount'] ?? 0);
              $interestRate = (float)($loan['interest_rate'] ?? 0);
              $duration = (int)($loan['duration_months'] ?? 0);
              $totalDue = $approvedAmount > 0 ? $approvedAmount + ($approvedAmount * $interestRate / 100) : 0;
              $paid = (float)($repaymentTotals[$loanId]['paid'] ?? 0);
              $repaymentCount = (int)($repaymentTotals[$loanId]['count'] ?? 0);
              $balanceRemaining = max($totalDue - $paid, 0);
              $monthlyInstallment = ($totalDue > 0 && $duration > 0) ? ($totalDue / $duration) : 0;
              $monthsRemaining = ($monthlyInstallment > 0) ? (int)ceil($balanceRemaining / $monthlyInstallment) : 0;
              $schedule = [];
              if ($totalDue > 0 && $duration > 0) {
                  $standardInstallment = round($totalDue / $duration, 2);
                  for ($month = 1; $month <= $duration; $month++) {
                      $amountDue = $month === $duration
                          ? round($totalDue - ($standardInstallment * ($duration - 1)), 2)
                          : $standardInstallment;
                      $schedule[] = ['month' => $month, 'amount' => $amountDue];
                  }
              }
            ?>
            <div class="section">
              <div class="section-head">
                <h3>Loan #<?php echo $loanId; ?></h3>
                <span class="status <?php echo h(loan_status_class($status)); ?>"><?php echo h(ucfirst($status)); ?></span>
              </div>

              <div class="split">
                <div>
                  <div class="metric-list">
                    <div class="metric-row"><span class="metric-label">Requested amount</span><span class="metric-value"><?php echo money((float)$loan['requested_amount']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Approved amount</span><span class="metric-value"><?php echo $approvedAmount > 0 ? money($approvedAmount) : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Interest rate</span><span class="metric-value"><?php echo $approvedAmount > 0 ? money($interestRate) . '%' : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Duration</span><span class="metric-value"><?php echo $duration > 0 ? $duration . ' months' : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Start date</span><span class="metric-value"><?php echo h(format_date($loan['start_date'] ?? null)); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Submitted</span><span class="metric-value"><?php echo h(format_datetime($loan['created_at'] ?? null)); ?></span></div>
                  </div>
                </div>

                <div>
                  <div class="metric-list">
                    <div class="metric-row"><span class="metric-label">Total due</span><span class="metric-value"><?php echo $totalDue > 0 ? money($totalDue) : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Paid so far</span><span class="metric-value"><?php echo $totalDue > 0 ? money($paid) : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Balance remaining</span><span class="metric-value"><?php echo $totalDue > 0 ? money($balanceRemaining) : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Payment count</span><span class="metric-value"><?php echo $repaymentCount; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Monthly installment</span><span class="metric-value"><?php echo $monthlyInstallment > 0 ? money($monthlyInstallment) : '-'; ?></span></div>
                    <div class="metric-row"><span class="metric-label">Months remaining</span><span class="metric-value"><?php echo $monthsRemaining > 0 ? $monthsRemaining : '-'; ?></span></div>
                  </div>
                </div>
              </div>

              <?php if ($status === 'pending'): ?>
                <p class="note">This application is pending administrator review.</p>
              <?php elseif ($status === 'rejected'): ?>
                <p class="note">This application was rejected. You may submit a new request whenever needed.</p>
              <?php else: ?>
                <div class="split">
                  <div class="section">
                    <h3>Pay This Loan</h3>
                    <?php if ($balanceRemaining <= 0): ?>
                      <div class="alert ok">This loan has been fully repaid.</div>
                    <?php else: ?>
                      <form method="POST" action="/DSLT/loans/repay_loan.php" class="loan-payment-form" data-balance="<?php echo h(number_format($balanceRemaining, 2, '.', '')); ?>">
                        <?php echo csrf_field(); ?>
                        <input type="hidden" name="loan_id" value="<?php echo $loanId; ?>">
                        <label for="amount_<?php echo $loanId; ?>">Amount</label>
                        <input type="number" step="0.01" min="0.01" max="<?php echo h(number_format($balanceRemaining, 2, '.', '')); ?>" id="amount_<?php echo $loanId; ?>" name="amount" data-payment-amount required>
                        <div class="form-feedback" data-payment-preview>Remaining after payment: <?php echo money($balanceRemaining); ?></div>
                        <button type="submit">Pay Loan</button>
                      </form>
                      <p class="note">Maximum repayment for this loan is <?php echo money($balanceRemaining); ?>. Once the balance reaches zero, the system will mark the loan as closed.</p>
                    <?php endif; ?>
                  </div>

                  <div class="section">
                    <h3>Payment Plan</h3>
                    <?php if (!$schedule): ?>
                      <div class="empty-state">The payment plan will appear after the loan is approved.</div>
                    <?php else: ?>
                      <div class="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Installment</th>
                            </tr>
                          </thead>
                          <tbody>
                            <?php foreach ($schedule as $row): ?>
                              <tr>
                                <td><?php echo (int)$row['month']; ?></td>
                                <td><?php echo money((float)$row['amount']); ?></td>
                              </tr>
                            <?php endforeach; ?>
                          </tbody>
                        </table>
                      </div>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endif; ?>
            </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<script src="/DSLT/assets/js/loan-payments.js"></script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
