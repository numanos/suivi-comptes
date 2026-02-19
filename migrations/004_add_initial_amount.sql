-- Migration: Add initial_amount column to envelopes table
-- This allows setting a starting capital in addition to annual contributions

ALTER TABLE envelopes 
ADD COLUMN IF NOT EXISTS initial_amount DECIMAL(12,2) DEFAULT 0;
