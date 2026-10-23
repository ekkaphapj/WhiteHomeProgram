-- invoice support: utility units + meter readings, tenant address
ALTER TABLE rent_payments ADD COLUMN water_units REAL;
ALTER TABLE rent_payments ADD COLUMN electric_units REAL;
ALTER TABLE rent_payments ADD COLUMN water_meter_prev TEXT;
ALTER TABLE rent_payments ADD COLUMN water_meter_curr TEXT;
ALTER TABLE rent_payments ADD COLUMN electric_meter_prev TEXT;
ALTER TABLE rent_payments ADD COLUMN electric_meter_curr TEXT;
ALTER TABLE tenants ADD COLUMN address TEXT;
