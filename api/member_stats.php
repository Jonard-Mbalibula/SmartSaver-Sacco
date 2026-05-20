<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

$userId = (int)$_SESSION['user_id'];

/* Member profile */
$stmt = $pdo->prepare("
    SELECT created_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
");
$stmt->execute([$userId]);
$memberSince = $stmt->fetchColumn() ?: null;

/* Savings totals */
$stmt = $pdo->prepare("
    SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
    FROM transactions
    WHERE user_id = ?
");
$stmt->execute([$userId]);
$s = $stmt->fetch(PDO::FETCH_ASSOC);

/* Month-to-date totals */
$stmt = $pdo->prepare("
    SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
    FROM transactions
    WHERE user_id = ?
      AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
");
$stmt->execute([$userId]);
$month = $stmt->fetch(PDO::FETCH_ASSOC);

/* Savings trend (last 7 days deposits only) */
$stmt = $pdo->prepare("
    SELECT DATE(created_at) AS day, IFNULL(SUM(amount),0) AS total
    FROM transactions
    WHERE user_id = ? AND type='deposit' AND created_at >= (CURDATE() - INTERVAL 6 DAY)
    GROUP BY DATE(created_at)
    ORDER BY day
");
$stmt->execute([$userId]);
$trendRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

/* Build last 7 days arrays (fill missing days with 0) */
$map = [];
foreach ($trendRows as $r) $map[$r['day']] = (float)$r['total'];

$days = [];
$values = [];
for ($i = 6; $i >= 0; $i--) {
    $d = (new DateTime())->modify("-$i day")->format('Y-m-d');
    $days[] = $d;
    $values[] = $map[$d] ?? 0;
}

/* Loan summary (approved only) */
$stmt = $pdo->prepare("
    SELECT
        COUNT(*) AS approved_loans,
        IFNULL(SUM(approved_amount),0) AS total_principal,
        IFNULL(SUM(approved_amount + (approved_amount * interest_rate/100)),0) AS total_due
    FROM loans
    WHERE user_id = ? AND status='approved'
");
$stmt->execute([$userId]);
$l = $stmt->fetch(PDO::FETCH_ASSOC);

/* Loan status counters */
$stmt = $pdo->prepare("
    SELECT status, COUNT(*) AS total
    FROM loans
    WHERE user_id = ?
    GROUP BY status
");
$stmt->execute([$userId]);
$statusCounts = [
    'pending' => 0,
    'approved' => 0,
    'closed' => 0,
    'rejected' => 0,
];
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $status = (string)$row['status'];
    if (array_key_exists($status, $statusCounts)) {
        $statusCounts[$status] = (int)$row['total'];
    }
}

/* Total repaid across all loans */
$stmt = $pdo->prepare("
    SELECT IFNULL(SUM(r.amount),0) AS repaid
    FROM loan_repayments r
    JOIN loans l ON l.loan_id = r.loan_id
    WHERE l.user_id = ?
");
$stmt->execute([$userId]);
$repaid = (float)$stmt->fetchColumn();

/* Recent transactions */
$stmt = $pdo->prepare("
    SELECT id, type, amount, is_reversal, created_at
    FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 6
");
$stmt->execute([$userId]);
$recentTransactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

/* Recent loan events */
$stmt = $pdo->prepare("
    SELECT loan_id, requested_amount, approved_amount, status, created_at
    FROM loans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 6
");
$stmt->execute([$userId]);
$recentLoans = $stmt->fetchAll(PDO::FETCH_ASSOC);

$recentActivity = [];

foreach ($recentTransactions as $row) {
    $type = (string)$row['type'];
    $recentActivity[] = [
        'category' => 'transaction',
        'title' => $type === 'deposit' ? 'Savings deposit posted' : 'Savings withdrawal posted',
        'status' => !empty($row['is_reversal']) ? 'recorded' : 'posted',
        'reference' => 'TXN-' . (int)$row['id'],
        'amount' => (float)$row['amount'],
        'date' => $row['created_at'],
    ];
}

foreach ($recentLoans as $row) {
    $status = (string)$row['status'];
    $amount = $row['approved_amount'] !== null ? (float)$row['approved_amount'] : (float)$row['requested_amount'];
    $title = match ($status) {
        'approved' => 'Loan approved',
        'closed' => 'Loan closed',
        'rejected' => 'Loan decision recorded',
        default => 'Loan application submitted',
    };

    $recentActivity[] = [
        'category' => 'loan',
        'title' => $title,
        'status' => $status,
        'reference' => 'LN-' . (int)$row['loan_id'],
        'amount' => $amount,
        'date' => $row['created_at'],
    ];
}

usort($recentActivity, static function (array $a, array $b): int {
    return strcmp((string)$b['date'], (string)$a['date']);
});
$recentActivity = array_slice($recentActivity, 0, 8);
$lastActivityAt = $recentActivity[0]['date'] ?? null;

echo json_encode([
    "deposits" => (float)$s["deposits"],
    "withdrawals" => (float)$s["withdrawals"],
    "balance" => (float)$s["deposits"] - (float)$s["withdrawals"],
    "trend_days" => $days,
    "trend_values" => $values,
    "this_month_deposits" => (float)$month["deposits"],
    "this_month_withdrawals" => (float)$month["withdrawals"],
    "approved_loans" => (int)$l["approved_loans"],
    "total_principal" => (float)$l["total_principal"],
    "total_due" => (float)$l["total_due"],
    "total_repaid" => $repaid,
    "loan_outstanding" => max(0, (float)$l["total_due"] - $repaid),
    "pending_loans" => $statusCounts["pending"],
    "closed_loans" => $statusCounts["closed"],
    "rejected_loans" => $statusCounts["rejected"],
    "member_since" => $memberSince,
    "last_activity_at" => $lastActivityAt,
    "recent_activity" => $recentActivity
]);
