<?php
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/audit.php';
require __DIR__ . '/../includes/security.php';

csrf_init();

$role = (string)($_SESSION["role"] ?? "");
$userId = (int)($_SESSION["user_id"] ?? 0);

if ($userId <= 0 || !in_array($role, ["member", "admin"], true)) {
    header("Location: /DSLT/auth/login.php");
    exit;
}

$redirectTo = $role === "admin" ? "/DSLT/admin/loan_payments.php" : "/DSLT/loans/loan_status.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Location: " . $redirectTo);
    exit;
}

csrf_verify();

$loan_id = (int)($_POST["loan_id"] ?? 0);
$amount  = (float)($_POST["amount"] ?? 0);

if ($loan_id <= 0 || $amount <= 0) {
    $_SESSION["flash_message"] = "Invalid repayment.";
    $_SESSION["flash_type"] = "bad";
    header("Location: " . $redirectTo);
    exit;
}

try {
    $pdo->beginTransaction();

    if ($role === "admin") {
        $stmt = $pdo->prepare("
            SELECT loan_id, user_id, approved_amount, interest_rate, status
            FROM loans
            WHERE loan_id = ?
            FOR UPDATE
        ");
        $stmt->execute([$loan_id]);
    } else {
        $stmt = $pdo->prepare("
            SELECT loan_id, user_id, approved_amount, interest_rate, status
            FROM loans
            WHERE loan_id = ? AND user_id = ?
            FOR UPDATE
        ");
        $stmt->execute([$loan_id, $userId]);
    }

    $loan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$loan || $loan["status"] !== "approved" || $loan["approved_amount"] === null || $loan["interest_rate"] === null) {
        $pdo->rollBack();
        $_SESSION["flash_message"] = "Loan not eligible for repayment.";
        $_SESSION["flash_type"] = "bad";
        header("Location: " . $redirectTo);
        exit;
    }

    $approved = (float)$loan["approved_amount"];
    $rate = (float)$loan["interest_rate"];
    $total_due = $approved + ($approved * $rate / 100.0);

    $stmt = $pdo->prepare("SELECT IFNULL(SUM(amount),0) FROM loan_repayments WHERE loan_id=?");
    $stmt->execute([$loan_id]);
    $paid = (float)$stmt->fetchColumn();

    $balance = $total_due - $paid;
    if ($amount > $balance + 0.00001) {
        $pdo->rollBack();
        $_SESSION["flash_message"] = "Repayment exceeds outstanding balance.";
        $_SESSION["flash_type"] = "bad";
        header("Location: " . $redirectTo);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO loan_repayments (loan_id, amount) VALUES (?, ?)");
    $stmt->execute([$loan_id, $amount]);

    $stmt = $pdo->prepare("SELECT IFNULL(SUM(amount),0) FROM loan_repayments WHERE loan_id=?");
    $stmt->execute([$loan_id]);
    $new_paid = (float)$stmt->fetchColumn();

    if ($new_paid >= $total_due - 0.00001) {
        $stmt = $pdo->prepare("UPDATE loans SET status='closed' WHERE loan_id=?");
        $stmt->execute([$loan_id]);
    }

    if ($role === "admin") {
        audit_log($pdo, $userId, "loan_repayment_recorded", "loan", $loan_id, [
            "amount" => $amount,
            "member_user_id" => (int)$loan["user_id"],
            "balance_before" => max($balance, 0),
            "balance_after" => max($total_due - $new_paid, 0),
        ]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Loan repayment failed: " . $e->getMessage());
    $_SESSION["flash_message"] = "Repayment could not be recorded. Please try again.";
    $_SESSION["flash_type"] = "bad";
    header("Location: " . $redirectTo);
    exit;
}

$_SESSION["flash_message"] = "Repayment recorded successfully.";
$_SESSION["flash_type"] = "ok";

header("Location: " . $redirectTo);
exit;
