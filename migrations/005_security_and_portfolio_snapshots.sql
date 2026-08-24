ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE email = 'admin@local';

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at),
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS envelope_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envelope_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  net_contributions DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_envelope_snapshot_date (envelope_id, snapshot_date),
  INDEX idx_snapshot_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS snapshot_placements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type_placement ENUM('Action', 'Immo', 'Obligations', 'Liquidites') NOT NULL,
  valorization DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (snapshot_id) REFERENCES envelope_snapshots(id) ON DELETE CASCADE,
  INDEX idx_snapshot_placements (snapshot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preserve existing annual data as snapshots at 31 December.
INSERT INTO envelope_snapshots (envelope_id, snapshot_date, net_contributions)
SELECT p.envelope_id,
       STR_TO_DATE(CONCAT(p.year, '-12-31'), '%Y-%m-%d'),
       COALESCE((SELECT SUM(ev.versements) FROM envelope_versements ev
                 WHERE ev.envelope_id = p.envelope_id AND ev.year <= p.year), 0)
FROM placements p
GROUP BY p.envelope_id, p.year
ON DUPLICATE KEY UPDATE net_contributions = VALUES(net_contributions);

INSERT INTO snapshot_placements (snapshot_id, name, type_placement, valorization)
SELECT s.id, p.name, p.type_placement, p.valorization
FROM placements p
JOIN envelope_snapshots s ON s.envelope_id = p.envelope_id
  AND s.snapshot_date = STR_TO_DATE(CONCAT(p.year, '-12-31'), '%Y-%m-%d')
LEFT JOIN snapshot_placements sp ON sp.snapshot_id = s.id
  AND sp.name = p.name AND sp.type_placement = p.type_placement
WHERE sp.id IS NULL;
