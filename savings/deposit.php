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
$redirectUrl = '/DSLT/savings/deposit.php';
$message = '';
$message_type = 'ok';
$flash = flash_get('member_deposit');
if ($flash !== null) {
    $message = $flash['message'];
    $message_type = $flash['type'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    if (!form_token_verify('member_deposit')) {
        flash_set('member_deposit', 'This form was already submitted. Refresh the page and try again.', 'bad');
        header('Location: ' . $redirectUrl);
        exit;
    }

    $amount = (float)($_POST['amount'] ?? 0);
    $paymentTarget = (string)($_POST['payment_target'] ?? 'savings');
    $loanId = (int)($_POST['loan_id'] ?? 0);

    if ($amount <= 0) {
        flash_set('member_deposit', 'Enter a valid amount.', 'bad');
    } elseif ($paymentTarget === 'savings') {
        $stmt = $pdo->prepare(
            "INSERT INTO transactions (user_id, type, amount, is_reversal, reversed_transaction_id)
             VALUES (?, 'deposit', ?, 0, NULL)"
        );
        $stmt->execute([$userId, $amount]);

        flash_set('member_deposit', 'Deposit recorded successfully.', 'ok');
    } elseif ($paymentTarget === 'loan') {
        if ($loanId <= 0) {
            flash_set('member_deposit', 'Select the loan you want to pay.', 'bad');
        } else {
            try {
                $pdo->beginTransaction();

                $stmt = $pdo->prepare(
                    "SELECT loan_id, approved_amount, interest_rate, status
                     FROM loans
                     WHERE loan_id = ? AND user_id = ?
                     FOR UPDATE"
                );
                $stmt->execute([$loanId, $userId]);
                $loan = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$loan || $loan['status'] !== 'approved' || $loan['approved_amount'] === null || $loan['interest_rate'] === null) {
                    $pdo->rollBack();
                    flash_set('member_deposit', 'That loan is not available for payment.', 'bad');
                } else {
                    $approvedAmount = (float)$loan['approved_amount'];
                    $interestRate = (float)$loan['interest_rate'];
                    $totalDue = $approvedAmount + ($approvedAmount * $interestRate / 100);

                    $stmt = $pdo->prepare("SELECT IFNULL(SUM(amount), 0) FROM loan_repayments WHERE loan_id = ?");
                    $stmt->execute([$loanId]);
                    $paid = (float)$stmt->fetchColumn();
                    $balanceRemaining = $totalDue - $paid;

                    if ($amount > $balanceRemaining + 0.00001) {
                        $pdo->rollBack();
                        flash_set('member_deposit', 'Loan payment exceeds the outstanding balance.', 'bad');
                    } else {
                        $stmt = $pdo->prepare("INSERT INTO loan_repayments (loan_id, amount) VALUES (?, ?)");
                        $stmt->execute([$loanId, $amount]);

                        $newPaid = $paid + $amount;
                        if ($newPaid >= $totalDue - 0.00001) {
                            $stmt = $pdo->prepare("UPDATE loans SET status = 'closed' WHERE loan_id = ?");
                            $stmt->execute([$loanId]);
                        }

                        $pdo->commit();
                        flash_set('member_deposit', 'Loan payment recorded successfully.', 'ok');
                    }
                }
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                error_log('Member loan payment failed: ' . $e->getMessage());
                flash_set('member_deposit', 'Loan payment could not be recorded. Please try again.', 'bad');
            }
        }
    } else {
        flash_set('member_deposit', 'Choose whether this payment is for savings or a loan.', 'bad');
    }

    header('Location: ' . $redirectUrl);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals,
        MAX(CASE WHEN type='deposit' THEN created_at END) AS last_deposit
     FROM transactions
     WHERE user_id = ?"
);
$stmt->execute([$userId]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
$deposits = (float)($summary['deposits'] ?? 0);
$withdrawals = (float)($summary['withdrawals'] ?? 0);
$balance = $deposits - $withdrawals;
$lastDeposit = $summary['last_deposit'] ?? null;

$stmt = $pdo->prepare(
    "SELECT id, amount, created_at
     FROM transactions
     WHERE user_id = ? AND type = 'deposit'
     ORDER BY created_at DESC
     LIMIT 8"
);
$stmt->execute([$userId]);
$recentDeposits = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare(
    "SELECT l.loan_id, l.requested_amount, l.approved_amount, l.interest_rate, l.duration_months,
            IFNULL(SUM(r.amount), 0) AS paid
     FROM loans l
     LEFT JOIN loan_repayments r ON r.loan_id = l.loan_id
     WHERE l.user_id = ?
       AND l.status = 'approved'
       AND l.approved_amount IS NOT NULL
       AND l.interest_rate IS NOT NULL
     GROUP BY l.loan_id, l.requested_amount, l.approved_amount, l.interest_rate, l.duration_months
     ORDER BY l.created_at DESC"
);
$stmt->execute([$userId]);
$activeLoans = [];
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $loan) {
    $approvedAmount = (float)$loan['approved_amount'];
    $interestRate = (float)$loan['interest_rate'];
    $totalDue = $approvedAmount + ($approvedAmount * $interestRate / 100);
    $paid = (float)$loan['paid'];
    $balanceRemaining = max($totalDue - $paid, 0);

    if ($balanceRemaining > 0) {
        $loan['total_due'] = $totalDue;
        $loan['balance_remaining'] = $balanceRemaining;
        $activeLoans[] = $loan;
    }
}

$activeLoanCount = count($activeLoans);
$activeLoanOutstanding = array_sum(array_map(static fn(array $loan): float => (float)$loan['balance_remaining'], $activeLoans));

$stmt = $pdo->prepare(
    "SELECT r.repayment_id, r.loan_id, r.amount
     FROM loan_repayments r
     INNER JOIN loans l ON l.loan_id = r.loan_id
     WHERE l.user_id = ?
     ORDER BY r.repayment_id DESC
     LIMIT 8"
);
$stmt->execute([$userId]);
$recentLoanPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);

$title = 'Save or Pay Loan';
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
            <h1>Save or Pay Loan</h1>
            <p>Choose where the money should go: savings or an active loan.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Savings balance</strong><br>
              <?php echo money($balance); ?>
            </div>
            <div class="hero-note">
              <strong>Total deposits</strong><br>
              <?php echo money($deposits); ?>
            </div>
            <div class="hero-note">
              <strong>Last deposit</strong><br>
              <?php echo h(format_datetime($lastDeposit)); ?>
            </div>
            <div class="hero-note">
              <strong>Loan outstanding</strong><br>
              <?php echo money((float)$activeLoanOutstanding); ?>
            </div>
          </div>
        </div>

        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>"><?php echo h($message); ?></div>
        <?php endif; ?>

        <div class="split">
          <div class="section">
            <h3>Enter Payment</h3>
            <form method="POST" class="deposit-payment-form">
              <?php echo csrf_field(); ?>
              <?php echo form_token_field('member_deposit'); ?>
              <label for="payment_target">Where should this money go?</label>
              <select id="payment_target" name="payment_target" data-payment-target>
                <option value="savings">Savings</option>
                <?php if ($activeLoans): ?>
                  <option value="loan">Pay a loan</option>
                <?php endif; ?>
              </select>

              <?php if ($activeLoans): ?>
                <div data-loan-payment-fields hidden>
                  <label for="loan_id">Active Loan</label>
                  <select id="loan_id" name="loan_id" data-loan-select>
                    <?php foreach ($activeLoans as $loan): ?>
                      <option value="<?php echo (int)$loan['loan_id']; ?>" data-balance="<?php echo h(number_format((float)$loan['balance_remaining'], 2, '.', '')); ?>">
                        Loan #<?php echo (int)$loan['loan_id']; ?> - balance <?php echo money((float)$loan['balance_remaining']); ?>
                      </option>
                    <?php endforeach; ?>
                  </select>
                </div>
              <?php endif; ?>

              <label for="amount">Amount</label>
              <input type="number" step="0.01" min="0.01" id="amount" name="amount" data-payment-amount required>
              <div class="amount-shortcuts" data-amount-shortcuts>
                <button type="button" data-amount="5000">5,000</button>
                <button type="button" data-amount="10000">10,000</button>
                <button type="button" data-amount="25000">25,000</button>
                <button type="button" data-amount="50000">50,000</button>
              </div>
              <div class="form-feedback" data-payment-preview>Savings balance will increase by the entered amount.</div>
              <button type="submit" data-payment-submit>Save Payment</button>
            </form>
            <p class="note">Savings deposits update your savings statement. Loan payments reduce the selected active loan balance and close it when fully paid.</p>
          </div>

          <div class="section">
            <h3>What Happens</h3>
            <div class="metric-list">
              <div class="metric-row">
                <div>
                  <div class="metric-label">Savings posting</div>
                  <div class="metric-value">Direct transaction entry</div>
                </div>
                <div class="metric-value">Live</div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Active loans</div>
                  <div class="metric-value">Available for payment</div>
                </div>
                <div class="metric-value"><?php echo (int)$activeLoanCount; ?></div>
              </div>
              <div class="metric-row">
                <div>
                  <div class="metric-label">Loan balance guard</div>
                  <div class="metric-value">Overpayment blocked</div>
                </div>
                <div class="metric-value">Yes</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Deposits</div>
      <div class="card-b">
        <?php if (!$recentDeposits): ?>
          <div class="empty-state">No deposits have been posted yet for this account.</div>
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
                <?php foreach ($recentDeposits as $deposit): ?>
                  <tr>
                    <td>#<?php echo (int)$deposit['id']; ?></td>
                    <td><?php echo money((float)$deposit['amount']); ?></td>
                    <td><?php echo h(format_datetime($deposit['created_at'] ?? null)); ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Recent Loan Payments</div>
      <div class="card-b">
        <?php if (!$recentLoanPayments): ?>
          <div class="empty-state">No loan payments have been posted yet for this account.</div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Loan</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($recentLoanPayments as $payment): ?>
                  <tr>
                    <td>#<?php echo (int)$payment['repayment_id']; ?></td>
                    <td>#<?php echo (int)$payment['loan_id']; ?></td>
                    <td><?php echo money((float)$payment['amount']); ?></td>
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

<script src="/DSLT/assets/js/deposit-payment.js"></script>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
