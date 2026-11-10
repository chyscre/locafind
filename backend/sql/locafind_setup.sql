-- LocaFind setup (simpler version). Safe to run more than once.
CREATE DATABASE IF NOT EXISTS locafind
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE locafind;

CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('lost', 'found') NOT NULL,
  name VARCHAR(60) NOT NULL,
  category VARCHAR(20) NOT NULL,
  description VARCHAR(240) NOT NULL DEFAULT '',
  photo MEDIUMTEXT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  radius SMALLINT UNSIGNED NULL,
  reporter_name VARCHAR(60) NOT NULL,
  contact VARCHAR(80) NOT NULL,
  custody ENUM('with_finder', 'security', 'returned') NULL,
  status ENUM('active', 'recovered') NOT NULL DEFAULT 'active',
  occurred_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_no VARCHAR(20) NOT NULL,
  display_name VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  contact VARCHAR(80) NOT NULL DEFAULT '',
  avatar VARCHAR(20) NOT NULL DEFAULT 'kitty',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_student_no (student_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_tokens_user (user_id),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id INT UNSIGNED NULL AFTER id;
ALTER TABLE reports ADD KEY IF NOT EXISTS idx_reports_user (user_id);

-- Sample reports with fixed ids, so running this again adds no duplicates.
INSERT IGNORE INTO reports (id, type, name, category, description, lat, lng, radius, reporter_name, contact, custody, status) VALUES
  (1, 'lost', 'Blue umbrella', 'umbrella', 'Navy blue foldable umbrella with a white handle. Last had it near the Library.', 15.4467870, 120.9387570, 40, 'Sample Student A', 'Messenger: Sample Student A', NULL, 'active'),
  (2, 'lost', 'Black backpack', 'bag', 'Black backpack with a keychain on the zipper. Left near the CICT Building.', 15.4493530, 120.9404100, 60, 'Sample Student B', 'Messenger: Sample Student B', NULL, 'active'),
  (3, 'lost', 'School ID', 'id', 'NEUST ID with a green lanyard. Probably at the Cafeteria.', 15.4451010, 120.9393970, NULL, 'Sample Student C', 'Messenger: Sample Student C', NULL, 'active'),
  (4, 'found', 'White tumbler', 'tumbler', 'White steel tumbler with stickers, found on a bench by the CAS Building.', 15.4468590, 120.9408480, NULL, 'Sample Student D', 'Messenger: Sample Student D', 'security', 'active'),
  (5, 'found', 'Car keys', 'keys', 'Set of keys with a small red tag, found at the NEUST Gym.', 15.4486510, 120.9410950, NULL, 'Sample Student E', 'Messenger: Sample Student E', 'with_finder', 'active');
