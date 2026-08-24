import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'suivi_comptes',
};

const createTablesSQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at),
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Themes table (4 grands thèmes)
CREATE TABLE IF NOT EXISTS themes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  theme_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Import batches table
CREATE TABLE IF NOT EXISTS import_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  record_count INT DEFAULT 0,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  libelle TEXT,
  note TEXT,
  amount DECIMAL(12,2) NOT NULL,
  category_id INT,
  subcategory_id INT,
  balance DECIMAL(12,2),
  is_pointed BOOLEAN DEFAULT FALSE,
  tags TEXT,
  import_batch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Enveloppes table (patrimoine)
CREATE TABLE IF NOT EXISTS envelopes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  exclude_from_gains BOOLEAN DEFAULT FALSE,
  closed_year INT DEFAULT NULL,
  annual_versement DECIMAL(12,2) DEFAULT NULL,
  open_year INT DEFAULT NULL,
  initial_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historical totals (pre-diversification)
CREATE TABLE IF NOT EXISTS historical_totals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Envelope versements (par année, cumulatif)
CREATE TABLE IF NOT EXISTS envelope_versements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envelope_id INT NOT NULL,
  year INT NOT NULL,
  versements DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_envelope_year (envelope_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Placements table
CREATE TABLE IF NOT EXISTS placements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envelope_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type_placement ENUM('Action', 'Immo', 'Obligations', 'Liquidites') NOT NULL,
  year INT NOT NULL,
  valorization DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dated portfolio snapshots. Legacy yearly placements remain available during migration.
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
`;

// Indexes to create (may already exist)
const indexes = [
  { name: 'idx_transactions_date', sql: 'CREATE INDEX idx_transactions_date ON transactions(date)' },
  { name: 'idx_transactions_category', sql: 'CREATE INDEX idx_transactions_category ON transactions(category_id)' },
  // Note: idx_transactions_month removed - MariaDB doesn't support functional indexes like MySQL 8.0
  { name: 'idx_placements_year', sql: 'CREATE INDEX idx_placements_year ON placements(year)' },
  { name: 'idx_placements_envelope', sql: 'CREATE INDEX idx_placements_envelope ON placements(envelope_id, year)' }
];

async function createIndexes(connection: any) {
  for (const idx of indexes) {
    try {
      await connection.query(idx.sql);
      console.log(`Index ${idx.name} created`);
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log(`Index ${idx.name} already exists, skipping`);
      } else if (error.code === 'ER_PARSE_ERROR') {
        console.log(`Index ${idx.name} has syntax error (may not be compatible with this MySQL/MariaDB version), skipping`);
      } else {
        throw error;
      }
    }
  }
}

async function migrateLegacyPortfolio(connection: any) {
  await connection.query(`
    INSERT INTO envelope_snapshots (envelope_id, snapshot_date, net_contributions)
    SELECT p.envelope_id, STR_TO_DATE(CONCAT(p.year, '-12-31'), '%Y-%m-%d'),
           COALESCE((SELECT SUM(ev.versements) FROM envelope_versements ev
                     WHERE ev.envelope_id = p.envelope_id AND ev.year <= p.year), 0)
    FROM placements p
    GROUP BY p.envelope_id, p.year
    ON DUPLICATE KEY UPDATE net_contributions = VALUES(net_contributions)
  `);
  await connection.query(`
    INSERT INTO snapshot_placements (snapshot_id, name, type_placement, valorization)
    SELECT s.id, p.name, p.type_placement, p.valorization
    FROM placements p
    JOIN envelope_snapshots s ON s.envelope_id = p.envelope_id
      AND s.snapshot_date = STR_TO_DATE(CONCAT(p.year, '-12-31'), '%Y-%m-%d')
    LEFT JOIN snapshot_placements sp ON sp.snapshot_id = s.id
      AND sp.name = p.name AND sp.type_placement = p.type_placement
    WHERE sp.id IS NULL
  `);
}

async function initDatabase() {
  let connection;
  
  try {
    // First connect without database to create it
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    console.log('Connected to MySQL server');
    
    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.query(`USE ${dbConfig.database}`);
    
    console.log(`Database ${dbConfig.database} created/selected`);
    
    // Create tables
    await connection.query(createTablesSQL);
    console.log('All tables created successfully');
    await connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user'");
    await connection.query("UPDATE users SET role = 'admin' WHERE email = 'admin@local'");
    await migrateLegacyPortfolio(connection);
    console.log('Legacy annual portfolio data migrated to dated snapshots');
    
    // Create indexes (ignore if already exists)
    await createIndexes(connection);
    
    // Seed default themes
    const [themes] = await connection.query('SELECT COUNT(*) as count FROM themes') as any[];
    if (themes[0].count === 0) {
      await connection.query(`
        INSERT INTO themes (name, is_default, display_order) VALUES
        ('Dépenses fixes', TRUE, 1),
        ('Dépenses variables', TRUE, 2),
        ('Revenus', TRUE, 3),
        ('Epargne', TRUE, 4)
      `);
      console.log('Default themes inserted');
      
      // Get theme IDs
      const [rows] = await connection.query('SELECT id, name FROM themes');
      const themesMap: Record<string, number> = {};
      (rows as any[]).forEach((row: any) => {
        themesMap[row.name] = row.id;
      });
      
      // Insert default categories based on Catégories.xlsx
      const categories = [
        { name: 'Impôts / taxes', theme: 'Dépenses fixes' },
        { name: 'Logement / maison', theme: 'Dépenses fixes' },
        { name: 'Loisirs', theme: 'Dépenses variables' },
        { name: 'Véhicule', theme: 'Dépenses variables' },
        { name: 'Alimentation', theme: 'Dépenses variables' },
        { name: 'Autres dépenses', theme: 'Dépenses variables' },
        { name: 'Vie quotidienne', theme: 'Dépenses variables' },
        { name: 'Enfants & Scolarité', theme: 'Dépenses variables' },
        { name: 'Numérique', theme: 'Dépenses variables' },
        { name: 'Famille', theme: 'Dépenses variables' },
        { name: 'Vacances / weekend', theme: 'Dépenses variables' },
        { name: 'Autres revenus', theme: 'Revenus' },
        { name: 'Revenus professionnels', theme: 'Revenus' },
        { name: 'Epargne', theme: 'Epargne' },
      ];
      
      for (const cat of categories) {
        await connection.query(
          'INSERT INTO categories (name, theme_id) VALUES (?, ?)',
          [cat.name, themesMap[cat.theme]]
        );
      }
      console.log('Default categories inserted');
    }
    
    // Never create a known default password. Set ADMIN_INITIAL_PASSWORD explicitly.
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users') as any[];
    if (users[0].count === 0 && process.env.ADMIN_INITIAL_PASSWORD) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD, 12);
      await connection.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
        ['admin@local', passwordHash, 'Administrateur']
      );
      console.log('Initial admin user created from ADMIN_INITIAL_PASSWORD');
    }
    
    console.log('Database initialization complete!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
