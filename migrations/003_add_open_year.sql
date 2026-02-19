-- Migration: Add open_year column to envelopes table
-- This allows calculating total versements based on annual contribution since opening year

ALTER TABLE envelopes 
ADD COLUMN IF NOT EXISTS open_year INT DEFAULT NULL;
