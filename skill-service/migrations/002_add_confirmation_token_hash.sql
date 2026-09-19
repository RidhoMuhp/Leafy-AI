ALTER TABLE pending_actions
    ADD COLUMN confirmation_token_hash CHAR(64) NOT NULL
    AFTER payload_json;

INSERT INTO schema_migrations (
    version,
    description
)
VALUES (
    '002',
    'Add hashed confirmation token for pending actions'
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description);