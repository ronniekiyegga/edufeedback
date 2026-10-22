# Student directory search

Status: accepted for the synthetic demo.

## Requirement

Search the organisation's student directory by a partial first name,
surname or institution reference, with case-insensitive matching.

Search applies to the complete matching dataset before pagination.
Filtering only the currently loaded browser page would produce
incomplete results.

## Decision

Perform search in PostgreSQL through Prisma.

Combine the organisation boundary, search predicate and continuation
predicate using AND. Treat percent signs, underscores and backslashes
as literal search input.

Keep the existing surname-and-ID ordering.

Bind filtered cursors to a SHA-256 fingerprint of the trimmed search
term inside the authenticated encrypted payload. Reject a cursor when
the search context changes, including an unfiltered cursor replayed
with a search and a filtered cursor replayed without one. New searches
start without a cursor.

Use an explicit search submission rather than sending a database
request on every keystroke.

## Alternatives

Client-side filtering is unsuitable because the browser only has one
page of students.

A separate search service introduces another deployment, indexing
pipeline and consistency boundary without demonstrated need.

PostgreSQL trigram indexes remain an option if measurements show
substring search is too expensive.

## Limits

Search matches individual fields. It does not parse a full name into
first-name and surname tokens or provide fuzzy matching.

The fingerprint covers the exact trimmed term, so a cursor issued for
`velmira` is rejected for `Velmira` even though both match the same
rows. The browser never sends that combination: submitting a search
drops the cursor.

The current B-tree index supports organisation and surname ordering.
It does not make arbitrary substring matching inexpensive.
No search-latency or scale claim has been established.

Results are not a snapshot. Concurrent changes can affect subsequent
pages.

## Privacy

The demo contains independently invented records only.

Search terms appear in browser URLs and may be retained in browser
history and infrastructure access logs. Application failure logs must
not contain search terms or cursor values.

Before using real pupil data, review search-state transport, URL
logging and retention alongside authentication and authorisation.

Cursor encryption does not provide authorisation.

## Verification

Route tests cover validation, blank searches and search-bound cursors.

PostgreSQL integration tests cover case-insensitive matching, literal
wildcards, references, organisation isolation and pagination.

Browser tests cover submission, cursor reset, the search term reaching
the API, retained search during pagination, empty results and failure
recovery.
