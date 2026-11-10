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
  photo MEDIUMTEXT NULL,                 -- compressed base64 data URL
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  radius SMALLINT UNSIGNED NULL,         -- lost reports only, metres
  reporter_name VARCHAR(60) NOT NULL,
  contact VARCHAR(80) NOT NULL,
  custody ENUM('with_finder', 'security', 'returned') NULL,  -- found reports only
  status ENUM('active', 'recovered') NOT NULL DEFAULT 'active',
  occurred_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample reports at real NEUST Sumacab buildings (coordinates from OpenStreetMap).
INSERT INTO reports (type, name, category, description, lat, lng, radius, reporter_name, contact, custody, status)
SELECT * FROM (
  SELECT 'lost' AS type, 'Blue umbrella' AS name, 'umbrella' AS category,
         'Navy blue foldable umbrella with a white handle. Last had it near the Library.' AS description,
         15.4467870 AS lat, 120.9387570 AS lng, 40 AS radius,
         'Sample Student A' AS reporter_name, 'Messenger: Sample Student A' AS contact,
         NULL AS custody, 'active' AS status
  UNION ALL SELECT 'lost', 'Black backpack', 'bag', 'Black backpack with a keychain on the zipper. Left near the CICT Building.',
         15.4493530, 120.9404100, 60, 'Sample Student B', 'Messenger: Sample Student B', NULL, 'active'
  UNION ALL SELECT 'lost', 'School ID', 'id', 'NEUST ID with a green lanyard. Probably at the Cafeteria.',
         15.4451010, 120.9393970, NULL, 'Sample Student C', 'Messenger: Sample Student C', NULL, 'active'
  UNION ALL SELECT 'found', 'White tumbler', 'tumbler', 'White steel tumbler with stickers, found on a bench by the CAS Building.',
         15.4468590, 120.9408480, NULL, 'Sample Student D', 'Messenger: Sample Student D', 'security', 'active'
  UNION ALL SELECT 'found', 'Car keys', 'keys', 'Set of keys with a small red tag, found at the NEUST Gym.',
         15.4486510, 120.9410950, NULL, 'Sample Student E', 'Messenger: Sample Student E', 'with_finder', 'active'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM reports);
