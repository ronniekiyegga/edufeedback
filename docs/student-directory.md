# Student directory

## Purpose

Help school staff identify students and view their placement for an
academic year, using the existing EduFeedbackPro table presentation.

## Delivery scope

Implemented:
- Organisation-scoped student listing.
- Encrypted cursor pagination ordered by surname and ID.
- Server-side search by first name, surname or reference, with
  pagination bound to the search.
- Academic-year tabs, defaulting to the newest year with enrolments.
- Students enrolled in the selected year, with that year's year group and
  class group.
- The original table's toolbar, typography, spacing, row heights,
  borders, hover treatment and horizontal scrolling on narrow screens.
- Loading, empty, no-enrolment, invalid-link and unavailable states.
- Synthetic demo data.

Not migrated from the original table: row selection, drag reordering,
column visibility, sorting, face-card view, refresh button, student
detail modal, avatars, priority, status, progress and last-active
columns, and total counts.

Authentication and permissions remain a separate increment.
The public demo must contain only independently invented records.

## Entities and rules

Organisation is the tenant boundary.

Student holds identity and an institution reference unique within its
organisation. Names are display values, not identifiers.

StudentEnrolment holds placement for an academic year. The current model
permits one placement per student per academic year; it does not track
class changes within that year.

An enrolment must reference a student in the same organisation.
The database enforces this through a composite foreign key.

## API

GET /students/academic-years

Returns academicYearStarts: years with enrolments, newest first, or an
empty list when the organisation has none.

GET /students?academicYearStart=2026&limit=25&q=<term>&cursor=<opaque-token>

academicYearStart is required. Returns items, nextCursor and limit for
students enrolled in that year. Each item contains id,
institutionStudentRef, firstName, surname, yearGroup (integer) and
classGroup (string or null).

The cursor is bound to the organisation, academic year and search.
Changing the year or search starts a new pagination sequence.

Invalid parameters return 400. Query failures return 503.
An empty successful result returns 200 with an empty items array.

See docs/decisions/student-directory-annual-placement.md for the
annual placement decision and its limits.

## Presentation rules

Preserve the original table's visual design.

Do not describe a database update timestamp as student activity.
Do not describe a CAT4 score as progress over time.
Priority and status need explicit business definitions before migration.

## Failure and consistency behaviour

A database failure must remain distinct from an empty directory.
Invalid pagination must not silently restart at the first page.

Pagination does not provide a snapshot. Inserts before the cursor appear
when browsing restarts; surname changes can move records across pages.

Organisation scoping is not user authorisation.
