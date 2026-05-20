<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/audit.php';
require __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/app_helpers.php';

csrf_init();

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $loanId = (int)($_POST['loan_id'] ?? 0);
    $action = (string)($_POST['action'] ?? '');

    if ($loanId > 0 && $action === 'reject') {
        $stmt = $pdo->prepare("UPDATE loans SET status = 'rejected', approved_by = ? WHERE loan_id = ?");
        $stmt->execute([(int)$_SESSION['user_id'], $loanId]);

        audit_log($pdo, (int)$_SESSION['user_id'], 'loan_rejected', 'loan', $loanId, []);
    }

    if ($loanId > 0 && $action === 'approve') {
        $approvedAmount = (float)($_POST['approved_amount'] ?? 0);
        $interestRate = (float)($_POST['interest_rate'] ?? 0);
        $startDate = (string)($_POST['start_date'] ?? '');

        if ($approvedAmount > 0 && $interestRate >= 0 && $startDate !== '') {
            $stmt = $pdo->prepare(
                "UPDATE loans
                 SET status = 'approved',
                     approved_amount = ?,
                     interest_rate = ?,
                     start_date = ?,
                     approved_by = ?
                 WHERE loan_id = ?"
            );
            $stmt->execute([$approvedAmount, $interestRate, $startDate, (int)$_SESSION['user_id'], $loanId]);

            audit_log(
                $pdo,
                (int)$_SESSION['user_id'],
                'loan_approved',
                'loan',
                $loanId,
                [
                    'approved_amount' => $approvedAmount,
                    'interest_rate' => $interestRate,
                    'start_date' => $startDate,
                ]
            );
        }
    }

    header('Location: /DSLT/admin/approve_loan.php');
    exit;
}

$pending = $pdo->query(
    "SELECT l.loan_id, l.requested_amount, l.duration_months, l.created_at, u.full_name, u.phone
     FROM loans l
     INNER JOIN users u ON u.user_id = l.user_id
     WHERE l.status = 'pending'
     ORDER BY l.created_at DESC"
)->fetchAll(PDO::FETCH_ASSOC);

$pendingCount = count($pending);
$approvedCount = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='approved'")->fetchColumn();
$rejectedCount = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='rejected'")->fetchColumn();
$pendingRequested = 0.0;
foreach ($pending as $loan) {
    $pendingRequested += (float)$loan['requested_amount'];
}
$approvedPrincipal = (float)$pdo->query(
    "SELECT IFNULL(SUM(approved_amount), 0)
     FROM loans
     WHERE status='approved'
       AND approved_amount IS NOT NULL"
)->fetchColumn();

$title = 'Loan Requests';
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
            <h1>Loan Requests</h1>
            <p>Review pending loan requests. Set the approved amount, interest, and start date before approving.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Pending</strong><br>
              <?php echo $pendingCount; ?> applications
            </div>
            <div class="hero-note">
              <strong>Pending requested</strong><br>
              <?php echo money($pendingRequested); ?>
            </div>
            <div class="hero-note">
              <strong>Approved</strong><br>
              <?php echo $approvedCount; ?> active decisions
            </div>
            <div class="hero-note">
              <strong>Rejected</strong><br>
              <?php echo $rejectedCount; ?> declined applications
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="label">Pending</div><div class="value"><?php echo $pendingCount; ?></div><div class="subvalue">Awaiting review</div></div>
          <div class="kpi"><div class="label">Pending Requested</div><div class="value"><?php echo money($pendingRequested); ?></div><div class="subvalue">Total value awaiting review</div></div>
          <div class="kpi"><div class="label">Approved</div><div class="value"><?php echo $approvedCount; ?></div><div class="subvalue">Currently approved</div></div>
          <div class="kpi"><div class="label">Approved Principal</div><div class="value"><?php echo money($approvedPrincipal); ?></div><div class="subvalue">Active approved amount</div></div>
          <div class="kpi"><div class="label">Rejected</div><div class="value"><?php echo $rejectedCount; ?></div><div class="subvalue">Closed without approval</div></div>
          <div class="kpi"><div class="label">Review Method</div><div class="value">Manual</div><div class="subvalue">Admin sets amount and rate</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Pending Requests</div>
      <div class="card-b">
        <?php if (!$pending): ?>
          <div class="empty-state">No pending loan applications at the moment.</div>
        <?php else: ?>
          <?php foreach ($pending as $loan): ?>
            <div class="section">
              <div class="section-head">
                <h3>Loan #<?php echo (int)$loan['loan_id']; ?></h3>
                <span class="status status-warn">Pending</span>
              </div>
              <div class="split">
                <div>
                  <div class="metric-list">
                    <div class="metric-row"><span class="metric-label">Member</span><span class="metric-value"><?php echo h($loan['full_name']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Phone</span><span class="metric-value"><?php echo h($loan['phone']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Requested amount</span><span class="metric-value"><?php echo money((float)$loan['requested_amount']); ?></span></div>
                    <div class="metric-row"><span class="metric-label">Duration</span><span class="metric-value"><?php echo (int)$loan['duration_months']; ?> months</span></div>
                    <div class="metric-row"><span class="metric-label">Applied</span><span class="metric-value"><?php echo h(format_datetime($loan['created_at'] ?? null)); ?></span></div>
                  </div>
                </div>

                <div>
                  <form method="POST">
                    <?php echo csrf_field(); ?>
                    <input type="hidden" name="loan_id" value="<?php echo (int)$loan['loan_id']; ?>">
                    <input type="hidden" name="action" value="approve">
                    <label for="approved_amount_<?php echo (int)$loan['loan_id']; ?>">Approved Amount</label>
                    <input type="number" step="0.01" min="0.01" id="approved_amount_<?php echo (int)$loan['loan_id']; ?>" name="approved_amount" value="<?php echo h(number_format((float)$loan['requested_amount'], 2, '.', '')); ?>" required>
                    <label for="interest_rate_<?php echo (int)$loan['loan_id']; ?>">Interest Rate (%)</label>
                    <input type="number" step="0.01" min="0" id="interest_rate_<?php echo (int)$loan['loan_id']; ?>" name="interest_rate" value="5.00" required>
                    <label for="start_date_<?php echo (int)$loan['loan_id']; ?>">Start Date</label>
                    <input type="date" id="start_date_<?php echo (int)$loan['loan_id']; ?>" name="start_date" value="<?php echo date('Y-m-d'); ?>" required>
                    <button type="submit">Approve Loan</button>
                  </form>

                  <form method="POST">
                    <?php echo csrf_field(); ?>
                    <input type="hidden" name="loan_id" value="<?php echo (int)$loan['loan_id']; ?>">
                    <input type="hidden" name="action" value="reject">
                    <button type="submit" class="btn danger">Reject Loan</button>
                  </form>
                </div>
              </div>
            </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
