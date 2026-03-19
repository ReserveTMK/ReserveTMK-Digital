-- Migration: Rename special_requests to booking_summary
-- Date: 2026-03-19
-- Description: Renames special_requests column to booking_summary on bookings table for cleaner reporting

ALTER TABLE bookings RENAME COLUMN special_requests TO booking_summary;
