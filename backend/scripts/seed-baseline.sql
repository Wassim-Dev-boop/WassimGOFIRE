\connect reservation_db
BEGIN;

INSERT INTO rooms (id, name, location, capacity, active, created_at, updated_at)
SELECT
  '11111111-1111-1111-1111-111111111001'::uuid,
  'Salle Atlas',
  'Batiment A - Niveau 1',
  30,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM rooms WHERE name = 'Salle Atlas'
);

INSERT INTO rooms (id, name, location, capacity, active, created_at, updated_at)
SELECT
  '11111111-1111-1111-1111-111111111002'::uuid,
  'Salle Orion',
  'Batiment B - Niveau 2',
  18,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM rooms WHERE name = 'Salle Orion'
);

INSERT INTO equipments (id, name, serial_number, description, active, created_at, updated_at)
SELECT
  '11111111-1111-1111-1111-111111112001'::uuid,
  'Projecteur Laser Epson',
  'EPS-LZR-9001',
  'Projecteur principal pour salles de reunion',
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM equipments WHERE serial_number = 'EPS-LZR-9001'
);

INSERT INTO equipments (id, name, serial_number, description, active, created_at, updated_at)
SELECT
  '11111111-1111-1111-1111-111111112002'::uuid,
  'Kit Visioconference Logitech',
  'LOG-VC-3100',
  'Camera, micro et haut-parleur pour reunions hybrides',
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM equipments WHERE serial_number = 'LOG-VC-3100'
);

INSERT INTO reservations (
  id,
  created_at,
  end_at,
  purpose,
  requester_username,
  security_checked_by,
  security_conflict,
  start_at,
  status,
  updated_at,
  equipment_id,
  room_id
)
SELECT
  '11111111-1111-1111-1111-111111113001'::uuid,
  NOW(),
  NOW() + INTERVAL '1 day 2 hours',
  'Comite technique hebdomadaire',
  'employe.cnstn',
  'securite.cnstn',
  FALSE,
  NOW() + INTERVAL '1 day',
  'APPROVED',
  NOW(),
  (SELECT id FROM equipments WHERE serial_number = 'EPS-LZR-9001' LIMIT 1),
  (SELECT id FROM rooms WHERE name = 'Salle Atlas' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM reservations WHERE id = '11111111-1111-1111-1111-111111113001'::uuid
);

INSERT INTO reservations (
  id,
  created_at,
  end_at,
  purpose,
  requester_username,
  security_checked_by,
  security_conflict,
  start_at,
  status,
  updated_at,
  equipment_id,
  room_id
)
SELECT
  '11111111-1111-1111-1111-111111113002'::uuid,
  NOW(),
  NOW() + INTERVAL '2 days 1 hour',
  'Atelier securite operationnelle',
  'chef.cnstn',
  NULL,
  FALSE,
  NOW() + INTERVAL '2 days',
  'PENDING',
  NOW(),
  (SELECT id FROM equipments WHERE serial_number = 'LOG-VC-3100' LIMIT 1),
  (SELECT id FROM rooms WHERE name = 'Salle Orion' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM reservations WHERE id = '11111111-1111-1111-1111-111111113002'::uuid
);

COMMIT;

\connect event_db
BEGIN;

INSERT INTO events (
  id,
  created_at,
  decided_by,
  decision_comment,
  description,
  end_at,
  location,
  requested_by,
  start_at,
  status,
  title,
  updated_at,
  online_event,
  zoom_meeting_number,
  zoom_passcode
)
SELECT
  '22222222-2222-2222-2222-222222221001'::uuid,
  NOW(),
  'chef.cnstn',
  'Plan valide',
  'Revue mensuelle des indicateurs securite',
  NOW() + INTERVAL '5 days 2 hours',
  'Salle Atlas',
  'employe.cnstn',
  NOW() + INTERVAL '5 days',
  'APPROVED',
  'Revue securite mensuelle',
  NOW(),
  FALSE,
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Revue securite mensuelle'
);

INSERT INTO events (
  id,
  created_at,
  decided_by,
  decision_comment,
  description,
  end_at,
  location,
  requested_by,
  start_at,
  status,
  title,
  updated_at,
  online_event,
  zoom_meeting_number,
  zoom_passcode
)
SELECT
  '22222222-2222-2222-2222-222222221002'::uuid,
  NOW(),
  NULL,
  NULL,
  'Session de sensibilisation cyber pour les equipes',
  NOW() + INTERVAL '8 days 2 hours',
  'En ligne (Zoom)',
  'employe.cnstn',
  NOW() + INTERVAL '8 days',
  'PENDING',
  'Session cyber interne',
  NOW(),
  TRUE,
  '987654321',
  'CNSTN2026'
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Session cyber interne'
);

INSERT INTO partner_invitations (id, access_approved, created_at, partner_email, partner_name, event_id)
SELECT
  '22222222-2222-2222-2222-222222222001'::uuid,
  FALSE,
  NOW(),
  'contact@partenaire-tech.tn',
  'Partenaire Tech',
  (SELECT id FROM events WHERE title = 'Session cyber interne' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM partner_invitations WHERE partner_email = 'contact@partenaire-tech.tn'
);

COMMIT;

\connect intervention_db
BEGIN;

INSERT INTO interventions (
  id,
  assigned_to,
  created_at,
  description,
  requested_by,
  status,
  title,
  updated_at,
  validated_by,
  validation_note
)
SELECT
  '33333333-3333-3333-3333-333333331001'::uuid,
  'salle.cnstn',
  NOW(),
  'Le videoprojecteur ne demarre plus dans la salle Atlas.',
  'employe.cnstn',
  'IN_PROGRESS',
  'Panne videoprojecteur salle Atlas',
  NOW(),
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM interventions WHERE title = 'Panne videoprojecteur salle Atlas'
);

INSERT INTO interventions (
  id,
  assigned_to,
  created_at,
  description,
  requested_by,
  status,
  title,
  updated_at,
  validated_by,
  validation_note
)
SELECT
  '33333333-3333-3333-3333-333333331002'::uuid,
  NULL,
  NOW(),
  'Maintenance preventive des detecteurs de securite.',
  'securite.cnstn',
  'REQUESTED',
  'Maintenance detecteurs',
  NOW(),
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM interventions WHERE title = 'Maintenance detecteurs'
);

COMMIT;

\connect ged_db
BEGIN;

INSERT INTO documents (
  id,
  approved_by,
  category,
  content,
  created_at,
  created_by,
  published_at,
  status,
  title,
  updated_at
)
SELECT
  '44444444-4444-4444-4444-444444441001'::uuid,
  'qualite.cnstn',
  'Procedure',
  'Procedure officielle de gestion des incidents techniques.',
  NOW(),
  'qualite.cnstn',
  NOW(),
  'PUBLISHED',
  'Procedure gestion incidents',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM documents WHERE title = 'Procedure gestion incidents'
);

INSERT INTO documents (
  id,
  approved_by,
  category,
  content,
  created_at,
  created_by,
  published_at,
  status,
  title,
  updated_at
)
SELECT
  '44444444-4444-4444-4444-444444441002'::uuid,
  NULL,
  'Guide',
  'Guide de preparation des salles pour evenements sensibles.',
  NOW(),
  'salle.cnstn',
  NULL,
  'IN_REVIEW',
  'Guide preparation salles',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM documents WHERE title = 'Guide preparation salles'
);

COMMIT;

\connect notification_db
BEGIN;

INSERT INTO notifications (
  id,
  created_at,
  message,
  read_flag,
  recipient_username,
  title,
  updated_at
)
SELECT
  '55555555-5555-5555-5555-555555551001'::uuid,
  NOW(),
  'Votre reservation pour Salle Atlas est confirmee.',
  FALSE,
  'employe.cnstn',
  'Reservation confirmee',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE id = '55555555-5555-5555-5555-555555551001'::uuid
);

INSERT INTO notifications (
  id,
  created_at,
  message,
  read_flag,
  recipient_username,
  title,
  updated_at
)
SELECT
  '55555555-5555-5555-5555-555555551002'::uuid,
  NOW(),
  'Une nouvelle demande d intervention attend votre prise en charge.',
  FALSE,
  'salle.cnstn',
  'Nouvelle intervention',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE id = '55555555-5555-5555-5555-555555551002'::uuid
);

COMMIT;
