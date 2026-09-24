-- Backup Monitoring v2 — skema MySQL 8.x
--
-- Catatan:
--  * `groups` adalah reserved word sejak MySQL 8.0.2, jadi nama tabel ini
--    WAJIB selalu ditulis dengan backtick di semua query.
--  * Semua kolom DATETIME disimpan dalam UTC. Koneksi aplikasi (API & n8n)
--    harus memakai time_zone '+00:00' / UTC_TIMESTAMP(), bukan NOW() lokal.

CREATE DATABASE IF NOT EXISTS backup_monitoring
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE backup_monitoring;

-- ============================================================
-- MASTER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS `groups` (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) UNIQUE NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hosts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    hostname        VARCHAR(255) UNIQUE NOT NULL,
    group_id        INT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verify_apps (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    domain                VARCHAR(255) UNIQUE NOT NULL,
    group_id              INT NOT NULL,
    category              ENUM('Strategis','Tinggi','Sedang','Rendah') DEFAULT NULL,
    category_updated_at   DATETIME DEFAULT NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE=InnoDB;

-- ============================================================
-- TRANSACTIONAL DATA (time-series, paling sering di-query)
-- ============================================================

CREATE TABLE IF NOT EXISTS backup_records (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    host_id         INT NOT NULL,
    group_id        INT NOT NULL,             -- denormalized: hindari JOIN untuk query harian
    report_date     DATE NOT NULL,             -- dateKey WIB, untuk agregasi per hari
    reported_at     DATETIME NOT NULL,         -- waktu laporan diterima (UTC), untuk window 17:00 WIB
    status          ENUM('OK','ERROR') NOT NULL,
    error_reason    TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id),
    INDEX idx_backup_date (report_date),
    INDEX idx_backup_host_date (host_id, report_date),
    INDEX idx_backup_group_date (group_id, report_date),
    INDEX idx_backup_reported_at (reported_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verify_records (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    app_id                INT NOT NULL,
    group_id              INT NOT NULL,
    report_date           DATE NOT NULL,
    reported_at           DATETIME NOT NULL,
    severity              ENUM('OK','WARN','CRITICAL') NOT NULL,
    latest_snapshot_time  DATETIME DEFAULT NULL,
    snapshot_count        INT DEFAULT NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES verify_apps(id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id),
    INDEX idx_verify_date (report_date),
    INDEX idx_verify_app_date (app_id, report_date),
    INDEX idx_verify_group_date (group_id, report_date),
    INDEX idx_verify_reported_at (reported_at)
) ENGINE=InnoDB;

-- ============================================================
-- CATATAN (3 level: host, group, verify_app)
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    entity_type     ENUM('host','group','verify_app') NOT NULL,
    entity_id       INT NOT NULL,    -- merujuk hosts.id / `groups`.id / verify_apps.id
    note_text       TEXT NOT NULL,
    category        VARCHAR(100),    -- 'Sudah Dihubungi Tim Aplikasi', 'Investigasi Berjalan', dst
    created_by      VARCHAR(100),    -- siap untuk fitur multi-user nanti, boleh NULL untuk sekarang
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_entity_note (entity_type, entity_id)
) ENGINE=InnoDB;
