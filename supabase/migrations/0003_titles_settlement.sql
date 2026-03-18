-- Migration: Add settlement tracking to titles

ALTER TABLE public.titles
ADD COLUMN settled_at date,
ADD COLUMN settlement_movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL;

CREATE INDEX idx_titles_settlement_movement_id ON public.titles(settlement_movement_id);
