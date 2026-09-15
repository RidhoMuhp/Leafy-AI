ALTER TABLE finance_transactions
    ADD COLUMN void_reason VARCHAR(255) NULL
        AFTER status,
    ADD COLUMN voided_at DATETIME NULL
        AFTER void_reason,
    ADD COLUMN voided_by CHAR(64) NULL
        AFTER voided_at;


INSERT INTO schema_migrations (
    version,
    description
)
VALUES (
    '004',
    'Add finance transaction void audit fields'
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description);