<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

if (($_SESSION["role"] ?? "") !== "admin") {
    http_response_code(403);
    echo json_encode(["error" => "Access denied"]);
    exit;
}

/* Global savings totals */
$s = $pdo->query("
    SELECT
        IFNULL(SUM(CASE WHEN type='deposit' THEN amount END), 0) AS deposits,
        IFNULL(SUM(CASE WHEN type='withdraw' THEN amount END), 0) AS withdrawals
    FROM transactions
")->fetch(PDO::FETCH_ASSOC);

/* Pending loans count */
$pending = (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status='pending'")->fetchColumn();

/* Loan status distribution */
$rows = $pdo->query("
    SELECT status, COUNT(*) AS c
    FROM loans
    GROUP BY status
")->fetchAll(PDO::FETCH_ASSOC);

$statusLabels = [];
$statusCounts = [];
foreach ($rows as $r) {
    $statusLabels[] = $r["status"];
    $statusCounts[] = (int)$r["c"];
}

echo json_encode([
    "deposits" => (float)$s["deposits"],
    "withdrawals" => (float)$s["withdrawals"],
    "balance" => (float)$s["deposits"] - (float)$s["withdrawals"],
    "pending_loans" => $pending,
    "loan_status_labels" => $statusLabels,
    "loan_status_counts" => $statusCounts
]);

