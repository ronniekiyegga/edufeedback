BEGIN;

DO $$
BEGIN
  BEGIN
    INSERT INTO student_enrolments (
      organisation_id, student_id,
      academic_year_start, year_group, updated_at
    )
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      2027, 10, CURRENT_TIMESTAMP
    );

    RAISE EXCEPTION 'FAIL: cross-organisation enrolment accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'PASS: cross-organisation enrolment rejected';
  END;

  BEGIN
    INSERT INTO students (
      organisation_id, institution_student_ref,
      surname, updated_at
    )
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      'DEMO-001', 'Duplicate', CURRENT_TIMESTAMP
    );

    RAISE EXCEPTION 'FAIL: duplicate organisation reference accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: duplicate organisation reference rejected';
  END;

  BEGIN
    UPDATE student_enrolments
    SET year_group = 0
    WHERE student_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    RAISE EXCEPTION 'FAIL: invalid year group accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: invalid year group rejected';
  END;

  BEGIN
    DELETE FROM organisations
    WHERE id = '11111111-1111-4111-8111-111111111111';

    RAISE EXCEPTION 'FAIL: organisation with students deleted';
  EXCEPTION
    WHEN restrict_violation THEN
      RAISE NOTICE 'PASS: organisation deletion restricted';
  END;
END
$$;

ROLLBACK;
