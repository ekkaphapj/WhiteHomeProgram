-- The White Home: room setup (A=ชั้น1, B=ชั้น2, C=ชั้น3)
-- รายวัน: ปกติ 450 / เซลล์ 400 · รายเดือน: 4,000 (แก้ได้)
UPDATE rooms SET floor = '1', room_type = 'monthly', daily_rate = NULL, monthly_rate = 4000, note = NULL WHERE room_number = 'A4';

INSERT INTO rooms (room_number, floor, room_type, daily_rate, monthly_rate, note) VALUES
  ('A3',  '1', 'daily',   450, NULL, 'ราคาเซลล์ 400 บาท'),
  ('A5',  '1', 'daily',   450, NULL, 'ราคาเซลล์ 400 บาท'),
  ('A7',  '1', 'daily',   450, NULL, 'ราคาเซลล์ 400 บาท'),
  ('A9',  '1', 'daily',   450, NULL, 'ราคาเซลล์ 400 บาท'),
  ('A6',  '1', 'monthly', NULL, 4000, NULL),
  ('A8',  '1', 'monthly', NULL, 4000, NULL),
  ('A10', '1', 'monthly', NULL, 4000, NULL),
  ('B1',  '2', 'daily',   450, NULL, 'ราคาเซลล์ 400 บาท'),
  ('B2',  '2', 'monthly', NULL, 4000, NULL),
  ('B3',  '2', 'monthly', NULL, 4000, NULL),
  ('B4',  '2', 'monthly', NULL, 4000, NULL),
  ('B5',  '2', 'monthly', NULL, 4000, NULL),
  ('B6',  '2', 'monthly', NULL, 4000, NULL),
  ('B7',  '2', 'monthly', NULL, 4000, NULL),
  ('B8',  '2', 'monthly', NULL, 4000, NULL),
  ('B9',  '2', 'monthly', NULL, 4000, NULL),
  ('B10', '2', 'monthly', NULL, 4000, NULL),
  ('C1',  '3', 'monthly', NULL, 4000, NULL),
  ('C2',  '3', 'monthly', NULL, 4000, NULL),
  ('C3',  '3', 'monthly', NULL, 4000, NULL),
  ('C4',  '3', 'monthly', NULL, 4000, NULL),
  ('C5',  '3', 'monthly', NULL, 4000, NULL),
  ('C7',  '3', 'monthly', NULL, 4000, NULL),
  ('C8',  '3', 'monthly', NULL, 4000, NULL),
  ('C9',  '3', 'monthly', NULL, 4000, NULL),
  ('C10', '3', 'monthly', NULL, 4000, NULL);
