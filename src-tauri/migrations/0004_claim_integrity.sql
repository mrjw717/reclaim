-- Reclaim 0.1.0 migration 0004: claim-integrity guarantee.
--
-- Adjudication already keeps claim state consistent inside its transaction
-- (adjudicate_match dismisses competing suggestions before confirming the
-- selected claim, and review_match refuses a second confirmed claimant).
-- This index enforces the same rule at the schema level so a found item can
-- never carry two confirmed claim associations, even through an unforeseen
-- code path.
--
-- A database that already contains two confirmed rows for one item fails this
-- migration loudly at startup instead of silently rewriting custody-adjacent
-- history. Through the application this state is unreachable, so a failure
-- here indicates hand-edited or out-of-product data that must be resolved
-- explicitly before Reclaim will open it.

CREATE UNIQUE INDEX match_reviews_single_confirmation
  ON match_reviews(found_item_id)
  WHERE status = 'confirmed';
