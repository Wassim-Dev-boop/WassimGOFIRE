-- V12: Stabilisation post-nettoyage (permissions + purge traces non livrables)

-- 1) Purger les traces de tests/E2E dans l'audit workflow (non livrables soutenance).
DELETE FROM workflow_audit_logs
WHERE COALESCE(comment, '') ILIKE ANY (ARRAY['%e2e%', '%test%', '%bonus%', '%lot%'])
   OR COALESCE(old_config, '') ILIKE ANY (ARRAY['%e2e%', '%test%', '%bonus%', '%lot%'])
   OR COALESCE(new_config, '') ILIKE ANY (ARRAY['%e2e%', '%test%', '%bonus%', '%lot%']);

-- 2) Stabiliser la matrice permissions pour supprimer les menus/actions mortes.
-- RESPONSABLE_IT: ne doit pas exposer GED/Evenements.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'RESPONSABLE_IT'
  AND p.code IN ('VIEW_EVENTS_MODULE', 'VIEW_GED_MODULE');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('VIEW_INTERVENTIONS_MODULE', 'VIEW_REPORTS_MODULE')
WHERE r.name = 'RESPONSABLE_IT'
ON CONFLICT DO NOTHING;

-- RESPONSABLE_SECURITE: doit pouvoir consulter le module Evenements pour la validation securite.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'VIEW_EVENTS_MODULE'
WHERE r.name = 'RESPONSABLE_SECURITE'
ON CONFLICT DO NOTHING;

-- RESPONSABLE_SALLE: consultation evenements autorisee, creation evenements retiree
-- (la creation reste reservee a EMPLOYE/CHEF/QUALITE/ADMIN dans le backend events).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'RESPONSABLE_SALLE'
  AND p.code = 'CREATE_EVENT';
