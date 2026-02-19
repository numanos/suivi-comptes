-- Migration: Create historical_totals table
-- Run this SQL on your database to add support for historical patrimoine data

CREATE TABLE IF NOT EXISTS historical_totals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Also add closed_year column to envelopes table if not exists
ALTER TABLE envelopes 
ADD COLUMN IF NOT EXISTS closed_year INT DEFAULT NULL;
