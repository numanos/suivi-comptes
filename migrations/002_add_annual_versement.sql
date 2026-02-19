-- Migration: Add annual_versement column to envelopes table
-- This allows tracking annual contributions separately from cumulative versements

ALTER TABLE envelopes 
ADD COLUMN IF NOT EXISTS annual_versement DECIMAL(12,2) DEFAULT NULL;
