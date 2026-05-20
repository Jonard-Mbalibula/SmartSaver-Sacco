<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/security.php';
require_once __DIR__ . '/../includes/app_helpers.php';

csrf_init();

if (($_SESSION['role'] ?? '') !== 'member') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];
$message = '';
$message_type = 'ok';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $requestedAmount = (float)($_POST['requested_amount'] ?? 0);
    $durationMonths = (int)($_POST['duration_months'] ?? 0);

    if ($requestedAmount <= 0 || $durationMonths <= 0) {
        $message = 'Enter a valid loan amount and duration.';
        $message_type = 'bad';
    } else {
        $stmt = $pdo->prepare(
            "INSERT INTO loans (user_id, requested_amount, duration_months, status)
             VALUES (?, ?, ?, 'pending')"
        );
        $stmt->execute([$userId, $requestedAmount, $durationMonths]);

        $message = 'Loan application submitted successfully and is now awaiting approval.';
        $message_type = 'ok';
    }
}

$stmt = $pdo->prepare(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
     FROM transactions
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$savings = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
$currentBalance = (float)($savings['deposits'] ?? 0) - (float)($savings['withdrawals'] ?? 0);

$stmt = $pdo->prepare(
    "SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_loans,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_loans,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_loans
     FROM loans
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$loanCounts = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

$title = 'Apply Loan';
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
            <h1>Apply Loan</h1>
            <p>Enter the amount you need and how many months you want to pay it back.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Current savings balance</strong><br>
              <?php echo money($currentBalance); ?>
            </div>
            <div class="hero-note">
              <strong>Pending applications</strong><br>
              <?php echo (int)($loanCounts['pending_loans'] ?? 0); ?>
            </div>
            <div class="hero-note">
              <strong>Active approved loans</strong><br>
              <?php echo (int)($loanCounts['approved_loans'] ?? 0); ?>
            </div>
          </div>
        </div>

        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>"><?php echo h($message); ?></div>
        <?php endif; ?>

        <div class="split">
          <div class="section">
            <h3>Loan Details</h3>
            <form method="POST">
              <?php echo csrf_field(); ?>
              <div class="form-grid">
                <div>
                  <label for="requested_amount">Requested Amount</label>
                  <input type="number" step="0.01" min="0.01" id="requested_amount" name="requested_amount" required>
                </div>
                <div>
                  <label for="duration_months">Duration (months)</label>
                  <input type="number" min="1" id="duration_months" name="duration_months" required>
                </div>
              </div>
              <button type="submit">Send Request</button>
            </form>
          </div>

          <div class="section">
            <h3>Before You Send</h3>
            <div class="metric-list">
              <div class="metric-row">
                <div>
                  <div class="metric-label">Review status</div>
                  <div class="metric-value">Starts as pending</div>
                </div>
                <div class="metric-value">Automatic</div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Final rate</div>
                  <div class="metric-value">Set during approval</div>
                </div>
                <div class="metric-value">Admin controlled</div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Rough monthly principal</div>
                  <div class="metric-value" id="monthlyEstimate">Enter amount and duration</div>
                </div>
                <div class="metric-value">Estimate only</div>
              </div>
            </div>
            <p class="note">For exact repayment terms, always refer to the approved loan record in My Loans after administrator review.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script nonce="<?php echo h(csp_nonce()); ?>">
(function () {
  var amountInput = document.getElementById('requested_amount');
  var durationInput = document.getElementById('duration_months');
  var estimate = document.getElementById('monthlyEstimate');

  function updateEstimate() {
    var amount = Number(amountInput.value || 0);
    var duration = Number(durationInput.value || 0);
    if (amount > 0 && duration > 0) {
      estimate.textContent = (amount / duration).toFixed(2) + ' per month before interest';
    } else {
      estimate.textContent = 'Enter amount and duration';
    }
  }

  amountInput.addEventListener('input', updateEstimate);
  durationInput.addEventListener('input', updateEstimate);
})();
</script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
