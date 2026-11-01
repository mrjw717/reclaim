ALTER TABLE organization ADD COLUMN operating_hours_json TEXT NOT NULL DEFAULT '[{"day":"Monday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Tuesday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Wednesday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Thursday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Friday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Saturday","closed":true,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Sunday","closed":true,"opens":"09:00","closes":"17:00","overnight":false}]'
  CHECK(json_valid(operating_hours_json));
ALTER TABLE organization ADD COLUMN legacy_operating_hours TEXT;
UPDATE organization SET legacy_operating_hours=NULLIF(trim(operating_hours),''),operating_hours='';
ALTER TABLE organization ADD COLUMN staff_name TEXT NOT NULL DEFAULT 'Desk staff'
  CHECK(length(trim(staff_name)) BETWEEN 1 AND 80);
ALTER TABLE organization ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#285c4b'
  CHECK(length(primary_color)=7 AND substr(primary_color,1,1)='#');
ALTER TABLE organization ADD COLUMN logo_data_url TEXT
  CHECK(logo_data_url IS NULL OR length(logo_data_url) <= 3000000);
