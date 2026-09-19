CREATE TABLE IF NOT EXISTS finance_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_finance_category_code (
        category_code
    ),
    KEY idx_finance_category_type_active (
        transaction_type,
        is_active
    )
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS finance_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transaction_code VARCHAR(64) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NULL,
    counterparty VARCHAR(150) NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    transaction_date DATE NOT NULL,
    payment_method VARCHAR(30) NULL,
    reference_number VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'posted',
    notes TEXT NULL,
    created_by CHAR(64) NOT NULL,
    updated_by CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_finance_transaction_code (
        transaction_code
    ),
    KEY idx_finance_transaction_date (
        transaction_date
    ),
    KEY idx_finance_transaction_type_date (
        transaction_type,
        transaction_date
    ),
    KEY idx_finance_transaction_category (
        category_id
    ),
    KEY idx_finance_transaction_client (
        client_id
    ),
    KEY idx_finance_transaction_status (
        status
    ),

    CONSTRAINT fk_finance_category
        FOREIGN KEY (category_id)
        REFERENCES finance_categories(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_finance_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


INSERT INTO finance_categories (
    category_code,
    name,
    transaction_type
)
VALUES
    ('sales', 'Penjualan', 'income'),
    ('service_income', 'Pendapatan Jasa', 'income'),
    ('capital', 'Modal', 'income'),
    ('other_income', 'Pemasukan Lainnya', 'income'),

    ('operations', 'Operasional', 'expense'),
    ('marketing', 'Pemasaran', 'expense'),
    ('internet', 'Internet', 'expense'),
    ('transport', 'Transportasi', 'expense'),
    ('equipment', 'Peralatan', 'expense'),
    ('salary', 'Gaji', 'expense'),
    ('rent', 'Sewa', 'expense'),
    ('other_expense', 'Pengeluaran Lainnya', 'expense')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    transaction_type = VALUES(transaction_type),
    is_active = TRUE;


INSERT INTO schema_migrations (
    version,
    description
)
VALUES (
    '003',
    'Add finance categories and transaction ledger'
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description);