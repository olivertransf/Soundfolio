# Listening archive

Open `/time-machine`, or `/demo/time-machine?month=2024-06` for the fictional example. The existing shared StreamsProvider remains the owner of listening records; no import or sync path is rewritten by the archive.

## Connected experiences

The Story view includes a month picker, adjacent-month controls, keyboard arrows outside editable/interactive controls, year overview, same-month links across years, factual narratives, rankings by plays/stored duration, first appearances, retention, brief bursts, returns, artist share changes, and a selectable day calendar. Calculation disclosures explain each pattern. Track drilldowns retain the month; existing entity pages expose full-history context and links back to it. Dashboard entries are deterministic.

Compare accepts months, named eras, years, and inclusive custom date ranges. Custom ranges are serialized in `aFrom`, `aTo`, `bFrom`, `bTo`; month, comparison month, view, sort, and timezone are URL state. Copy period URL also serializes current search filters. Period comparisons report totals, plays per calendar day, artist Jaccard overlap, shared/unique tracks, first observations, artist share changes, and weekday/hour counts.

Rediscover provides evidence, private browser-local queue/dismiss/elsewhere controls, export, memory attachment, and Spotify links only for recognizable imported IDs. Eras support covers from existing album artwork, colors, editing, merging, memories, comparisons, and JSON export. Suggested boundaries compare artist play-share distributions across three consecutive months, with minimum activity and persistence thresholds. Users provide all personal labels.

Explore searches music, memories, tags, named eras, and manual work metadata. Date, first/latest observed month, minimum-play, source-ID, and note filters narrow music results. Sessions expose timestamp-based grouping, ordered tracks, repeated adjacent pairs, and annotations. Composer/work/performer annotations are opt-in corrections; originals are untouched. Different recording annotations can be compared within a work using observed plays and stored duration.

## Definitions and ownership

`lib/archive-analytics.ts` owns all new period calculations and configurable `ARCHIVE_RULES`. It uses existing entity normalization and cross-source deduplication. The index is cached by immutable provider-array identity and timezone; a new snapshot after import, sync, deletion, or refresh invalidates it. Track-indexed rows avoid rescanning the entire history for every comeback. No external metadata calls are added.

First observed means first in *loaded available history*. Boundary months and incomplete provider pages are flagged. Zero-record months remain unknown. Retention requires three plays in the three subsequent calendar months and history extending past that window; it cannot establish absence of listening outside this archive. Five plays qualify repeat patterns and meaningful changes; returns require a 90-day observed gap. Changes use percentage-point play-share differences, including artists disappearing from observed records.

The legacy stream schema does not preserve explicit duration provenance. New views deliberately call duration totals **stored time**: Last.fm values and legacy catalog-based values are not measured listening time. Zero, negative, and invalid durations do not create listening credit. Full catalog lengths are never newly substituted for missing durations. Existing dashboards still use their established overlap-credit calculations, so their minutes can differ from the archive's explicitly labeled stored-duration totals. Missing album titles are excluded from distinct known-album totals. Session boundaries use a conservative 30-minute timestamp gap; start/end-anchor uncertainty prevents reliable duration-adjusted sessions with legacy data.

Annotations (`lib/archive-notes.ts`) are versioned, stored independently in localStorage, and namespaced by account UID or fictional demo. Imports and analytics never write this storage. They are device-local, not cloud-synced or encrypted; people with access to the browser profile can access them. Malformed annotation storage is rejected without overwriting it. Changing accounts clears the rendered namespace immediately. Exports are the current backup mechanism. There is no photo upload or public publishing endpoint.

## Export formats

- Period JSON (`soundfolio-period-v1`): period, IANA timezone, coverage/duration explanations, summary, ranked entities, original loaded records in the period. Dates are ISO strings; `ms`/`durationMs` are milliseconds; `days` are local `YYYY-MM-DD`; `months` maps `YYYY-MM` to plays. Personal annotations are excluded.
- History JSON (`soundfolio-history-v1`): raw loaded records, timezone, provenance limitation. This may be a partial library when pagination has not finished.
- Annotation JSON: `version: 1`, memories, eras, work corrections, queue and dismissed IDs. Targets identify a month, era, entity, date, or session. This export intentionally includes private writing.
- Era/queue JSON: named range and observed tracks, or queued track/artist/last-observed entries.
- PNG summary and browser print: local downloads/actions only. PNG excludes memories and labels fictional demo content. Printing includes the currently visible monthly story and personal writing.

## Verification and remaining limits

Automated tests cover timezone rollover, imported-history boundaries, retention and insufficient follow-up, deduplication, missing/source-specific duration, missing albums, changes to zero, unequal durations, zero denominators, cache invalidation, session gaps, annotation validation/isolation, and era merging without losing memories. The fictional demo has fixed UTC generation from March 2022 through November 3, 2026, a missing month, quiet/partial months, evolving cohorts, classical recordings, a June 2024 brief burst, and lasting discoveries.

Browser verification covers month/track return navigation, comparison rendering, memory create/edit/delete and reload persistence, rediscovery queue persistence, JSON/PNG downloads, and mobile widths. Live account authorization, additional imports/syncs, and their refresh journeys require configured Firebase credentials; the available connector currently has neither an authenticated user nor an active project. Existing cloud rules and import storage are unchanged.

Cloud annotation sync, raw-source provenance backfill, worker/server aggregates for very large histories, photo storage, reliable duration-adjusted session boundaries, and externally verified album-edition completion are not implemented. The interface explicitly limits its claims accordingly; it contains no simulated playback, AI-dependent narrative service, or automatic public sharing.
