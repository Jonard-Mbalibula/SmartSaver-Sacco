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

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    exit('Invalid member.');
}

$stmt = $pdo->prepare("SELECT user_id, full_name, phone FROM users WHERE user_id = ? AND role = 'member'");
$stmt->execute([$userId]);
$member = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$member) {
    exit('Member not found.');
}

$redirectUrl = '/DSLT/admin/transaction.php?user_id=' . $userId;
$message = '';
$message_type = 'ok';
$flash = flash_get('admin_transaction');
if ($flash !== null) {
    $message = $flash['message'];
    $message_type = $flash['type'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    if (!form_token_verify('admin_transaction')) {
        flash_set('admin_transaction', 'This form was already submitted. Refresh the page and try again.', 'bad');
        header('Location: ' . $redirectUrl);
        exit;
    }

    $action = (string)($_POST['action'] ?? '');

    if ($action === 'add') {
        $type = (string)($_POST['type'] ?? '');
        $amount = (float)($_POST['amount'] ?? 0);

        if (!in_array($type, ['deposit', 'withdraw'], true) || $amount <= 0) {
            flash_set('admin_transaction', 'Invalid transaction data.', 'bad');
        } else {
            $stmt = $pdo->prepare(
                "INSERT INTO transactions (user_id, type, amount, is_reversal, reversed_transaction_id)
                 VALUES (?, ?, ?, 0, NULL)"
            );
            $stmt->execute([$userId, $type, $amount]);

            audit_log(
                $pdo,
                (int)$_SESSION['user_id'],
                'transaction_added',
                'transaction',
                null,
                [
                    'member_user_id' => $userId,
                    'type' => $type,
                    'amount' => $amount,
                ]
            );

            flash_set('admin_transaction', 'Transaction added successfully.', 'ok');
        }
    } elseif ($action === 'reverse') {
        $reverseId = (int)($_POST['reverse_id'] ?? 0);

        if ($reverseId <= 0) {
            flash_set('admin_transaction', 'Invalid transaction selected.', 'bad');
        } else {
            $stmt = $pdo->prepare(
                "SELECT id, type, amount, is_reversal
                 FROM transactions
                 WHERE id = ? AND user_id = ?"
            );
            $stmt->execute([$reverseId, $userId]);
            $original = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$original) {
                flash_set('admin_transaction', 'Transaction not found.', 'bad');
            } elseif ((int)$original['is_reversal'] === 1) {
                flash_set('admin_transaction', 'You cannot reverse a reversal transaction.', 'bad');
            } else {
                $stmt = $pdo->prepare('SELECT COUNT(*) FROM transactions WHERE reversed_transaction_id = ?');
                $stmt->execute([$reverseId]);
                $alreadyReversed = (int)$stmt->fetchColumn();

                if ($alreadyReversed > 0) {
                    flash_set('admin_transaction', 'This transaction has already been reversed.', 'bad');
                } else {
                    $reverseType = $original['type'] === 'deposit' ? 'withdraw' : 'deposit';
                    $stmt = $pdo->prepare(
                        "INSERT INTO transactions (user_id, type, amount, is_reversal, reversed_transaction_id)
                         VALUES (?, ?, ?, 1, ?)"
                    );
                    $stmt->execute([$userId, $reverseType, (float)$original['amount'], $reverseId]);

                    audit_log(
                        $pdo,
                        (int)$_SESSION['user_id'],
                        'transaction_reversed',
                        'transaction',
                        $reverseId,
                        [
                            'member_user_id' => $userId,
                            'reversal_type' => $reverseType,
                        ]
                    );

                    flash_set('admin_transaction', 'Transaction reversed successfully.', 'ok');
                }
            }
        }
    } else {
        flash_set('admin_transaction', 'Unsupported transaction action.', 'bad');
    }

    header('Location: ' . $redirectUrl);
    exit;
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
    "SELECT id, type, amount, created_at, is_reversal, reversed_transaction_id
     FROM transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 200"
);
$stmt->execute([$userId]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$reversedMap = [];
foreach ($transactions as $transaction) {
    if (!empty($transaction['reversed_transaction_id'])) {
        $reversedMap[(int)$transaction['reversed_transaction_id']] = true;
    }
}

$title = 'Member Savings';
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
            <h1><?php echo h($member['full_name']); ?> Savings</h1>
            <p>Add a deposit or withdrawal, or reverse a wrong entry.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Phone</strong><br>
              <?php echo h($member['phone']); ?>
            </div>
            <div class="hero-note">
              <strong>Current balance</strong><br>
              <?php echo money($balance); ?>
            </div>
            <div class="hero-note">
              <strong>Total postings shown</strong><br>
              <?php echo count($transactions); ?> recent records
            </div>
          </div>
        </div>

        <?php if ($message !== ''): ?>
          <div class="alert <?php echo h($message_type); ?>"><?php echo h($message); ?></div>
        <?php endif; ?>

        <div class="split">
          <div class="section">
            <h3>Add Savings Entry</h3>
            <form method="POST">
              <?php echo csrf_field(); ?>
              <?php echo form_token_field('admin_transaction'); ?>
              <input type="hidden" name="action" value="add">
              <label for="type">Entry Type</label>
              <select id="type" name="type" required>
                <option value="deposit">Deposit</option>
                <option value="withdraw">Withdraw</option>
              </select>
              <label for="amount">Amount</label>
              <input type="number" step="0.01" min="0.01" id="amount" name="amount" required>
              <button type="submit">Save Entry</button>
            </form>
          </div>

          <div class="section">
            <h3>Current Balance</h3>
            <div class="metric-list">
              <div class="metric-row"><span class="metric-label">Deposits</span><span class="metric-value"><?php echo money((float)($totals['deposits'] ?? 0)); ?></span></div>
              <div class="metric-row"><span class="metric-label">Withdrawals</span><span class="metric-value"><?php echo money((float)($totals['withdrawals'] ?? 0)); ?></span></div>
              <div class="metric-row"><span class="metric-label">Corrections</span><span class="metric-value">Reverse wrong entries</span></div>
            </div>
            <p class="note">Use reversals for corrections so historical entries remain visible to administrators and reports.</p>
          </div>
        </div>
      </div>
    </div>

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
                  <th>Note</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($transactions as $transaction): ?>
                  <?php $transactionId = (int)$transaction['id']; ?>
                  <tr>
                    <td>#<?php echo $transactionId; ?></td>
                    <td><span class="status <?php echo h(transaction_class((string)$transaction['type'], (int)$transaction['is_reversal'])); ?>"><?php echo h(ucfirst((string)$transaction['type'])); ?><?php if ((int)$transaction['is_reversal'] === 1): ?> reversal<?php endif; ?></span></td>
                    <td><?php echo money((float)$transaction['amount']); ?></td>
                    <td><?php echo h(format_datetime($transaction['created_at'] ?? null)); ?></td>
                    <td>
                      <?php if ((int)$transaction['is_reversal'] === 1): ?>
                        Reverses #<?php echo (int)$transaction['reversed_transaction_id']; ?>
                      <?php else: ?>
                        Normal entry
                      <?php endif; ?>
                    </td>
                    <td>
                      <?php if ((int)$transaction['is_reversal'] === 1): ?>
                        Reversal entry
                      <?php elseif (!empty($reversedMap[$transactionId])): ?>
                        Already reversed
                      <?php else: ?>
                        <form method="POST" style="margin:0;">
                          <?php echo csrf_field(); ?>
                          <?php echo form_token_field('admin_transaction'); ?>
                          <input type="hidden" name="action" value="reverse">
                          <input type="hidden" name="reverse_id" value="<?php echo $transactionId; ?>">
                          <button type="submit" onclick="return confirm('Reverse this transaction? An opposite entry will be created.');">Reverse</button>
                        </form>
                      <?php endif; ?>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
        <p class="note"><a href="/DSLT/admin/members_view.php?user_id=<?php echo $userId; ?>">Back to member</a></p>
      </div>
    </div>
  </div>
</div>

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
