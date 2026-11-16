# Revenue-first dashboard: overview milestone

The existing project overview now includes acquisition sources from `GET /api/projects/{project_id}/acquisition`. Owners can choose first touch, last touch, or last non-direct touch; the existing reporting-period selector applies. Counts are distinct visitors with observed touchpoints, and the card shows up to five source groups. The report is not filtered by the overview's event-property filter, which is stated on the card. Direct or unknown includes missing source evidence; see [acquisition report definitions](ACQUISITION_REPORT.md).

The source card handles loading, empty data, and request failures with retry. Revenue reporting is explicitly unavailable; no amount or payment integration is presented.

No database migrations are introduced. This is an incremental overview change: new/returning visitor metrics, conversions, revenue data and the remaining requested product sections are not implemented by this milestone. No production deployment or migration has been performed.
