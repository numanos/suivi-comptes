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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_month ON transactions(date);

-- Enveloppes table (patrimoine)
CREATE TABLE IF NOT EXISTS envelopes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  exclude_from_gains BOOLEAN DEFAULT FALSE,
  closed_year INT DEFAULT NULL,
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

CREATE INDEX idx_placements_year ON placements(year);
CREATE INDEX idx_placements_envelope ON placements(envelope_id, year);
`;

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
    
    // Create default admin user if not exists (password: admin123)
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users') as any[];
    if (users[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        ['admin@local', passwordHash, 'Administrateur']
      );
      console.log('Default admin user created (email: admin@local, password: admin123)');
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
