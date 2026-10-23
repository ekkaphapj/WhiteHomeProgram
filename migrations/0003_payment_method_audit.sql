-- payment method tracking + audit trail for transactions
ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer'));
ALTER TABLE stays ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer'));
ALTER TABLE rent_payments ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer'));

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('edit', 'delete')),
  label TEXT,                    -- human-readable name of the record at time of change
  changes TEXT,                  -- JSON: { field: { from, to } } for edits
  snapshot TEXT,                 -- JSON: full row for deletions
  performed_by INTEGER REFERENCES users(id),
  performed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_time ON audit_log(performed_at);
