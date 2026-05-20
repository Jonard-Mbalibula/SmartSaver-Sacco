<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/app_helpers.php';

if (($_SESSION['role'] ?? '') !== 'admin') {
    header('Location: /DSLT/auth/login.php');
    exit;
}

$query = trim((string)($_GET['q'] ?? ''));
$params = [];
$sql = "SELECT u.user_id, u.full_name, u.phone, u.created_at,
               IFNULL(t.deposits, 0) AS deposits,
               IFNULL(t.withdrawals, 0) AS withdrawals,
               IFNULL(t.deposits, 0) - IFNULL(t.withdrawals, 0) AS savings_balance,
               IFNULL(l.loan_count, 0) AS loan_count,
               IFNULL(l.active_loans, 0) AS active_loans,
               IFNULL(l.loan_outstanding, 0) AS loan_outstanding
        FROM users u
        LEFT JOIN (
            SELECT user_id,
                   SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) AS deposits,
                   SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) AS withdrawals
            FROM transactions
            GROUP BY user_id
        ) t ON t.user_id = u.user_id
        LEFT JOIN (
            SELECT x.user_id,
                   COUNT(*) AS loan_count,
                   SUM(CASE WHEN x.status = 'approved' THEN 1 ELSE 0 END) AS active_loans,
                   SUM(CASE WHEN x.status = 'approved' THEN GREATEST(x.total_due - IFNULL(x.paid, 0), 0) ELSE 0 END) AS loan_outstanding
            FROM (
                SELECT l.loan_id, l.user_id, l.status,
                       CASE
                           WHEN l.approved_amount IS NOT NULL AND l.interest_rate IS NOT NULL
                           THEN l.approved_amount + (l.approved_amount * l.interest_rate / 100)
                           ELSE 0
                       END AS total_due,
                       IFNULL(r.paid, 0) AS paid
                FROM loans l
                LEFT JOIN (
                    SELECT loan_id, SUM(amount) AS paid
                    FROM loan_repayments
                    GROUP BY loan_id
                ) r ON r.loan_id = l.loan_id
            ) x
            GROUP BY x.user_id
        ) l ON l.user_id = u.user_id
        WHERE u.role = 'member'";

if ($query !== '') {
    $sql .= ' AND (u.full_name LIKE ? OR u.phone LIKE ?)';
    $params[] = '%' . $query . '%';
    $params[] = '%' . $query . '%';
}

$sql .= ' ORDER BY u.created_at DESC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$members = $stmt->fetchAll(PDO::FETCH_ASSOC);
$memberCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='member'")->fetchColumn();
$directorySavings = 0.0;
$directoryLoanOutstanding = 0.0;
$directoryActiveLoans = 0;

foreach ($members as $member) {
    $directorySavings += (float)$member['savings_balance'];
    $directoryLoanOutstanding += (float)$member['loan_outstanding'];
    $directoryActiveLoans += (int)$member['active_loans'];
}

$title = 'Members';
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
            <h1>Members</h1>
            <p>Find a member, check savings and loans, or open their account.</p>
          </div>
          <div class="hero-meta">
            <div class="hero-note">
              <strong>Total members</strong><br>
              <?php echo $memberCount; ?> registered
            </div>
            <div class="hero-note">
              <strong>Current filter</strong><br>
              <?php echo $query !== '' ? h($query) : 'All members'; ?>
            </div>
            <div class="hero-note">
              <strong>Listed savings</strong><br>
              <?php echo money($directorySavings); ?>
            </div>
            <div class="hero-note">
              <strong>Listed loan due</strong><br>
              <?php echo money($directoryLoanOutstanding); ?>
            </div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="label">Shown Members</div><div class="value"><?php echo count($members); ?></div><div class="subvalue">Matching the current filter</div></div>
          <div class="kpi"><div class="label">Savings Balance</div><div class="value"><?php echo money($directorySavings); ?></div><div class="subvalue">Net savings among shown members</div></div>
          <div class="kpi"><div class="label">Active Loans</div><div class="value"><?php echo $directoryActiveLoans; ?></div><div class="subvalue">Approved loans among shown members</div></div>
          <div class="kpi"><div class="label">Loan Outstanding</div><div class="value"><?php echo money($directoryLoanOutstanding); ?></div><div class="subvalue">Unpaid active loan balances</div></div>
        </div>

        <div class="section">
          <h3>Find Member</h3>
          <form method="GET">
            <label for="q">Member name or phone number</label>
            <input type="text" id="q" name="q" value="<?php echo h($query); ?>" placeholder="Search by name or phone">
            <button type="submit">Search</button>
          </form>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Member List</div>
      <div class="card-b">
        <?php if (!$members): ?>
          <div class="empty-state">No members matched the current search.</div>
        <?php else: ?>
          <div class="table-toolbar">
            <input type="search" id="membersFilter" data-table-search="membersTable" placeholder="Filter this list…" aria-label="Filter member list">
          </div>
          <div class="table-wrap">
            <table id="membersTable">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Savings Balance</th>
                  <th>Active Loan Due</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($members as $member): ?>
                  <tr>
                    <td><?php echo h($member['full_name']); ?></td>
                    <td><?php echo h($member['phone']); ?></td>
                    <td>
                      <?php echo money((float)$member['savings_balance']); ?>
                      <div class="note">Deposits <?php echo money((float)$member['deposits']); ?> / withdrawals <?php echo money((float)$member['withdrawals']); ?></div>
                    </td>
                    <td>
                      <?php echo money((float)$member['loan_outstanding']); ?>
                      <div class="note"><?php echo (int)$member['active_loans']; ?> active / <?php echo (int)$member['loan_count']; ?> total loans</div>
                    </td>
                    <td><?php echo h(format_datetime($member['created_at'] ?? null)); ?></td>
                    <td>
                      <a href="/DSLT/admin/members_view.php?user_id=<?php echo (int)$member['user_id']; ?>">View</a>
                      |
                      <a href="/DSLT/admin/members_edit.php?user_id=<?php echo (int)$member['user_id']; ?>">Edit</a>
                      |
                      <a href="/DSLT/admin/transaction.php?user_id=<?php echo (int)$member['user_id']; ?>">Savings</a>
                    </td>
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

<?php require __DIR__ . '/../includes/layout_bottom.php'; ?>
