-- Migration: Rename self_rating to rating in profiles and guest_players tables
-- This migration preserves existing data while updating column names

BEGIN;

-- Rename column in profiles table
ALTER TABLE profiles RENAME COLUMN self_rating TO rating;

-- Update check constraint name to match new column
ALTER TABLE profiles DROP CONSTRAINT profiles_self_rating_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rating_check CHECK (rating >= 1 AND rating <= 10);

-- Rename column in guest_players table  
ALTER TABLE guest_players RENAME COLUMN self_rating TO rating;

-- Update check constraint name to match new column
ALTER TABLE guest_players DROP CONSTRAINT guest_players_self_rating_check;
ALTER TABLE guest_players ADD CONSTRAINT guest_players_rating_check CHECK (rating >= 1 AND rating <= 10);

-- Create compatibility view for legacy self_rating references
CREATE OR REPLACE VIEW profiles_legacy AS 
SELECT *, rating AS self_rating FROM profiles;

CREATE OR REPLACE VIEW guest_players_legacy AS 
SELECT *, rating AS self_rating FROM guest_players;

COMMIT; 