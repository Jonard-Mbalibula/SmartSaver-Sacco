<?php
$role = $_SESSION['role'] ?? '';
$current = basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

function is_active(string $file, string $current): string
{
    return $file === $current ? 'active' : '';
}
?>

<nav class="nav" id="app-sidebar" aria-label="Main navigation">
  <?php if ($role === 'member'): ?>
    <a class="nav__link <?php echo is_active('dashboard.php', $current); ?>" data-nav-icon="home" href="/DSLT/member/dashboard.php">Home</a>
    <a class="nav__link <?php echo is_active('deposit.php', $current); ?>" data-nav-icon="deposit" href="/DSLT/savings/deposit.php">Save or Pay Loan</a>
    <a class="nav__link <?php echo is_active('withdraw.php', $current); ?>" data-nav-icon="withdraw" href="/DSLT/savings/withdraw.php">Withdraw</a>
    <a class="nav__link <?php echo is_active('balance.php', $current); ?>" data-nav-icon="statement" href="/DSLT/savings/balance.php">Statement</a>
    <a class="nav__link <?php echo is_active('loan_request.php', $current); ?>" data-nav-icon="apply" href="/DSLT/loans/loan_request.php">Apply Loan</a>
    <a class="nav__link <?php echo is_active('loan_status.php', $current); ?>" data-nav-icon="loans" href="/DSLT/loans/loan_status.php">My Loans</a>
    <a class="nav__link danger" data-nav-icon="logout" href="/DSLT/auth/logout.php">Logout</a>
  <?php elseif ($role === 'admin'): ?>
    <a class="nav__link <?php echo is_active('dashboard.php', $current); ?>" data-nav-icon="home" href="/DSLT/admin/dashboard.php">Home</a>
    <a class="nav__link <?php echo is_active('approve_loan.php', $current); ?>" data-nav-icon="requests" href="/DSLT/admin/approve_loan.php">Loan Requests</a>
    <a class="nav__link <?php echo is_active('loan_payments.php', $current); ?>" data-nav-icon="payment" href="/DSLT/admin/loan_payments.php">Receive Loan Payment</a>
    <a class="nav__link <?php echo is_active('members.php', $current); ?>" data-nav-icon="members" href="/DSLT/admin/members.php">Members</a>
    <a class="nav__link <?php echo is_active('reports.php', $current); ?>" data-nav-icon="reports" href="/DSLT/admin/reports.php">Reports</a>
    <a class="nav__link <?php echo is_active('audit_logs.php', $current); ?>" data-nav-icon="logs" href="/DSLT/admin/audit_logs.php">Activity Logs</a>
    <a class="nav__link danger" data-nav-icon="logout" href="/DSLT/auth/logout.php">Logout</a>
  <?php endif; ?>
</nav>
