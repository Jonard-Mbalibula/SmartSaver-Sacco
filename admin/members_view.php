<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    exit('Invalid member.');
}

$stmt = $pdo->prepare("SELECT user_id, full_name, phone, role, created_at FROM users WHERE user_id = ?");
$stmt->execute([$userId]);
$member = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$member) {
    exit('Member not found.');
}

$stmt = $pdo->prepare(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
     FROM transactions
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$totals = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
$balance = (float)($totals['deposits'] ?? 0) - (float)($totals['withdrawals'] ?? 0);

$stmt = $pdo->prepare(
    "SELECT id, type, amount, created_at
     FROM transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20"
);
$stmt->execute([$userId]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare(
    "SELECT l.loan_id, l.requested_amount, l.approved_amount, l.interest_rate, l.duration_months,
            l.status, l.created_at, IFNULL(SUM(r.amount), 0) AS paid
     FROM loans l
     LEFT JOIN loan_repayments r ON r.loan_id = l.loan_id
     WHERE l.user_id = ?
     GROUP BY l.loan_id, l.requested_amount, l.approved_amount, l.interest_rate, l.duration_months,
              l.status, l.created_at
     ORDER BY l.created_at DESC
     LIMIT 5"
);
$stmt->execute([$userId]);
$loans = $stmt->fetchAll(PDO::FETCH_ASSOC);

$activeLoans = 0;
$loanOutstanding = 0.0;
$loanRepaid = 0.0;
foreach ($loans as $loan) {
    $approvedAmount = (float)($loan['approved_amount'] ?? 0);
    $interestRate = (float)($loan['interest_rate'] ?? 0);
    $totalDue = $approvedAmount > 0 ? $approvedAmount + ($approvedAmount * $interestRate / 100) : 0;
    $paid = (float)($loan['paid'] ?? 0);
    $loanRepaid += $paid;

    if ((string)$loan['status'] === 'approved') {
        $activeLoans++;
        $loanOutstanding += max($totalDue - $paid, 0);
    }
}

$title = 'Member Profile';
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
            <h1><?php echo h($member['full_name']); ?></h1>
            <p>Review this member's savings, loans, and account details.</p>
            <div class="action-row">
              <a class="btn" href="/DSLT/admin/transaction.php?user_id=<?php echo $userId; ?>">Manage Savings</a>
              <a class="btn secondary" href="/DSLT/admin/members_edit.php?user_id=<?php echo $userId; ?>">Edit Member</a>
            </div>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Phone</strong><br>
              <?php echo h($member['phone']); ?>
            </div>
            <div class="hero-note">
              <strong>Joined</strong><br>
              <?php echo h(format_datetime($member['created_at'] ?? null)); ?>
            </div>
            <div class="hero-note">
              <strong>Current savings balance</strong><br>
              <?php echo money($balance); ?>
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="label">Deposits</div><div class="value"><?php echo money((float)($totals['deposits'] ?? 0)); ?></div><div class="subvalue">Recorded deposits</div></div>
          <div class="kpi"><div class="label">Withdrawals</div><div class="value"><?php echo money((float)($totals['withdrawals'] ?? 0)); ?></div><div class="subvalue">Recorded withdrawals</div></div>
          <div class="kpi"><div class="label">Balance</div><div class="value"><?php echo money($balance); ?></div><div class="subvalue">Member savings position</div></div>
          <div class="kpi"><div class="label">Active Loans</div><div class="value"><?php echo $activeLoans; ?></div><div class="subvalue">Approved and not fully closed</div></div>
          <div class="kpi"><div class="label">Loan Outstanding</div><div class="value"><?php echo money($loanOutstanding); ?></div><div class="subvalue">Unpaid active loan balance</div></div>
          <div class="kpi"><div class="label">Loan Paid</div><div class="value"><?php echo money($loanRepaid); ?></div><div class="subvalue">Payments in latest loan records</div></div>
        </div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-h">Recent Savings Entries</div>
        <div class="card-b">
          <?php if (!$transactions): ?>
            <div class="empty-state">No transactions found for this member.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Posted</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($transactions as $transaction): ?>
                    <tr>
                      <td>#<?php echo (int)$transaction['id']; ?></td>
                      <td><?php echo h(ucfirst((string)$transaction['type'])); ?></td>
                      <td><?php echo money((float)$transaction['amount']); ?></td>
                      <td><?php echo h(format_datetime($transaction['created_at'] ?? null)); ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="card">
        <div class="card-h">Recent Loans</div>
        <div class="card-b">
          <?php if (!$loans): ?>
            <div class="empty-state">No loan records found for this member.</div>
          <?php else: ?>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Loan</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($loans as $loan): ?>
                    <?php
                      $approvedAmount = (float)($loan['approved_amount'] ?? 0);
                      $interestRate = (float)($loan['interest_rate'] ?? 0);
                      $totalDue = $approvedAmount > 0 ? $approvedAmount + ($approvedAmount * $interestRate / 100) : 0;
                      $paid = (float)($loan['paid'] ?? 0);
                      $remaining = max($totalDue - $paid, 0);
                    ?>
                    <tr>
                      <td>#<?php echo (int)$loan['loan_id']; ?><div class="note"><?php echo h(format_datetime($loan['created_at'] ?? null)); ?></div></td>
                      <td><span class="status <?php echo h(loan_status_class((string)$loan['status'])); ?>"><?php echo h(ucfirst((string)$loan['status'])); ?></span></td>
                      <td><?php echo money((float)$loan['requested_amount']); ?></td>
                      <td><?php echo $approvedAmount > 0 ? money($approvedAmount) : '-'; ?><div class="note"><?php echo $approvedAmount > 0 ? money($interestRate) . '% interest' : ''; ?></div></td>
                      <td><?php echo $totalDue > 0 ? money($paid) : '-'; ?></td>
                      <td><?php echo $totalDue > 0 ? money($remaining) : '-'; ?></td>
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

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
