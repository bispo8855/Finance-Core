-- Migration: Add opening balance fields to accounts
-- This adds the necessary fields to track the exact point in time when an account balance was set.

ALTER TABLE public.accounts 
ADD COLUMN opening_balance numeric NOT NULL DEFAULT 0,
ADD COLUMN opening_balance_date date;

-- Migrate existing 'initial_balance' data to the new structure
-- We assume the initial balance was set today if there's no opening date yet.
UPDATE public.accounts 
SET opening_balance = initial_balance, 
    opening_balance_date = CURRENT_DATE 
WHERE initial_balance IS NOT NULL AND opening_balance_date IS NULL;
