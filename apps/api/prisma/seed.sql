BEGIN;

INSERT INTO organisations (id, name, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111',
   'Demo Organisation A', CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222',
   'Demo Organisation B', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (
  id, organisation_id, institution_student_ref,
  first_name, surname, updated_at
)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111',
   'DEMO-001', 'Asha', 'Reed', CURRENT_TIMESTAMP),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222',
   'DEMO-001', 'Morgan', 'Cole', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO student_enrolments (
  organisation_id, student_id,
  academic_year_start, year_group, class_group, updated_at
)
VALUES
  ('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   2026, 9, '9A', CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   2026, 10, '10B', CURRENT_TIMESTAMP)
ON CONFLICT (organisation_id, student_id, academic_year_start)
DO NOTHING;

COMMIT;
