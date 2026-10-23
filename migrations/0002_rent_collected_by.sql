-- track which staff member collected each rent payment
ALTER TABLE rent_payments ADD COLUMN collected_by INTEGER REFERENCES users(id);
