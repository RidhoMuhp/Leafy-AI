ALTER TABLE `knowledge_documents`
    ADD COLUMN `short_code` VARCHAR(20) NULL
        AFTER `document_code`,
    ADD COLUMN `document_type` VARCHAR(20) NOT NULL
        DEFAULT 'general' AFTER `mime_type`,
    ADD COLUMN `uploaded_by` VARCHAR(64) NULL
        AFTER `status`;

CREATE UNIQUE INDEX `uq_knowledge_documents_short_code`
    ON `knowledge_documents` (`short_code`);

CREATE INDEX `idx_knowledge_documents_uploaded_by`
    ON `knowledge_documents` (`uploaded_by`);
