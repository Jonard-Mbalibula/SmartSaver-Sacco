-- DSLT Database Schema
-- Target: MySQL / MariaDB (XAMPP)
-- Notes:
-- - Uses utf8mb4 for full Unicode.
-- - Designed to match existing PHP queries in this project.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `dslt_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `dslt_db`;

-- -----------------------------
-- users
-- -----------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','member') NOT NULL DEFAULT 'member',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------
-- transactions
-- -----------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('deposit','withdraw') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `is_reversal` TINYINT(1) NOT NULL DEFAULT 0,
  `reversed_transaction_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user_created` (`user_id`, `created_at`),
  KEY `idx_transactions_reversed_tx` (`reversed_transaction_id`),
  CONSTRAINT `fk_transactions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_transactions_reversed_tx`
    FOREIGN KEY (`reversed_transaction_id`) REFERENCES `transactions` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------
-- loans
-- -----------------------------
CREATE TABLE IF NOT EXISTS `loans` (
  `loan_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `requested_amount` DECIMAL(12,2) NOT NULL,
  `approved_amount` DECIMAL(12,2) NULL,
  `interest_rate` DECIMAL(6,2) NULL,
  `duration_months` INT UNSIGNED NOT NULL,
  `start_date` DATE NULL,
  `status` ENUM('pending','approved','rejected','closed') NOT NULL DEFAULT 'pending',
  `approved_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`loan_id`),
  KEY `idx_loans_user_created` (`user_id`, `created_at`),
  KEY `idx_loans_status_created` (`status`, `created_at`),
  KEY `idx_loans_approved_by` (`approved_by`),
  CONSTRAINT `fk_loans_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loans_approved_by`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------
-- loan_repayments
-- -----------------------------
CREATE TABLE IF NOT EXISTS `loan_repayments` (
  `repayment_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loan_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`repayment_id`),
  KEY `idx_repayments_loan_created` (`loan_id`, `created_at`),
  CONSTRAINT `fk_repayments_loan`
    FOREIGN KEY (`loan_id`) REFERENCES `loans` (`loan_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------
-- audit_logs
-- -----------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `audit_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(40) NOT NULL,
  `target_id` BIGINT UNSIGNED NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_audit_actor_created` (`actor_user_id`, `created_at`),
  KEY `idx_audit_action_created` (`action`, `created_at`),
  CONSTRAINT `fk_audit_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------
-- Optional seed admin (change password after import)
-- -----------------------------
-- Password hash below is for: Admin@1234 (bcrypt)
-- You can remove this section if you prefer creating users via the UI.
INSERT INTO `users` (`full_name`,`phone`,`password_hash`,`role`)
SELECT 'System Admin', '0000000000',
       '$2y$10$ce9zU0GDFS6ZRy0pM8CNbO5iuH1isqjkhOBIlhPjwJKK546fA5AE2',
       'admin'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `role`='admin' LIMIT 1);

