# Acquisition reports

`GET /api/projects/{project_id}/acquisition?days=30&model=first_touch` requires a signed-in project owner. Supported periods are 7, 30, and 90 days; models are `first_touch`, `last_touch`, and `last_non_direct`.

The report counts distinct visitors with an observed touchpoint during the selected rolling period. It selects each visitor's earliest, latest, or latest non-direct touchpoint from retained history before the period ends. Last non-direct falls back to the latest direct-or-unknown touchpoint. Equal timestamps are ordered by event ID. The response returns the total and at most 50 source groups.

A touchpoint with campaign parameters is a campaign; its label is the UTM source, or the referrer if available, otherwise Unknown source. A touchpoint with only a referrer is a referral. Missing both is Direct or unknown: browsers can suppress referrers, so it is not proof of direct traffic. First touch means earliest retained observation, not necessarily the visitor's actual first visit. Client-supplied data can be incomplete or manipulated.

This endpoint reports visitors, not revenue. It does not connect visitors to payments or infer identity. Historical coverage depends on tracking consent, collection, and retention.
