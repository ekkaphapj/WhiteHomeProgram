-- The White Home — initial schema
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL UNIQUE,
  floor TEXT,
  room_type TEXT NOT NULL DEFAULT 'both' CHECK (room_type IN ('daily', 'monthly', 'both')),
  maintenance INTEGER NOT NULL DEFAULT 0,
  daily_rate REAL,
  monthly_rate REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_count INTEGER NOT NULL DEFAULT 1,
  checkin_date TEXT NOT NULL,
  checkout_date TEXT,
  nights INTEGER NOT NULL DEFAULT 1,
  daily_rate REAL NOT NULL,
  total_amount REAL NOT NULL,
  deposit REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_out', 'cancelled')),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stays_checkin ON stays(checkin_date);
CREATE INDEX idx_stays_room ON stays(room_id, status);

CREATE TABLE tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  name TEXT NOT NULL,
  phone TEXT,
  id_card TEXT,
  contract_start TEXT NOT NULL,
  contract_end TEXT,
  monthly_rent REAL NOT NULL,
  deposit REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tenants_room ON tenants(room_id, status);

CREATE TABLE rent_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  period TEXT NOT NULL,
  rent_amount REAL NOT NULL DEFAULT 0,
  water_amount REAL NOT NULL DEFAULT 0,
  electric_amount REAL NOT NULL DEFAULT 0,
  other_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, period)
);
CREATE INDEX idx_rent_period ON rent_payments(period, status);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  ref_type TEXT CHECK (ref_type IN ('stay', 'rent_payment')),
  ref_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_txn_date ON transactions(txn_date);
CREATE INDEX idx_txn_type_date ON transactions(type, txn_date);
CREATE INDEX idx_txn_ref ON transactions(ref_type, ref_id);
