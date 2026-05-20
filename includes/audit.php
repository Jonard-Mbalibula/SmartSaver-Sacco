<?php
/**
 * Write an audit log entry.
 *
 * @param PDO   $pdo
 * @param int   $actorUserId
 * @param string $action
 * @param string $targetType  e.g. 'loan', 'user', 'transaction'
 * @param int|null $targetId
 * @param array $details
 */
function audit_log(PDO $pdo, int $actorUserId, string $action, string $targetType, ?int $targetId, array $details = []): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

    // Keep details compact and safe
    $detailsJson = json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $stmt = $pdo->prepare("
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$actorUserId, $action, $targetType, $targetId, $detailsJson, $ip, $ua]);
}
