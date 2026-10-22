# Student directory annual placement

Status: accepted for the synthetic demo.

## Decision

The directory lists students for one academic year at a time. Placement
comes from the existing `StudentEnrolment` model: a student appears in a
year only when they have an enrolment for it, and that enrolment supplies
the year group and class group shown beside their identity. No tables or
migrations were added.

`GET /students` requires `academicYearStart`, so every query and cursor
names its year explicitly. `GET /students/academic-years` lists the years
that have enrolments, newest first. The web app uses the newest year when
the URL names none. Once the year is known, every directory link carries
it, so a shared link keeps meaning the same year after a newer enrolment
year appears.

Cursors carry the academic year inside the encrypted payload. A cursor is
rejected when the requested year differs, in the same way as a changed
search. Cursors issued before this change lack the year and are rejected.

A year link that the organisation has no enrolments for shows an explicit
state with a link back to the newest year, rather than an empty table.

## Limits

One placement per student per academic year. Class changes within a year
are not tracked, and the class shown is the stored value, not a history.

The newest year is the latest with any enrolment, not today's date. If
next year's enrolments are loaded early, the directory defaults to that
year.

Year groups and class groups are displayed as stored. Class groups are
free text and may be missing; the table shows "Not recorded".

The directory reports how many students are on the current page, not a
total for the year, and pagination moves forward only.
