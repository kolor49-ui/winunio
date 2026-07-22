-- MVP seed: RoundUnlockRule (docs/DATA_MODEL.md, ADR-010)
-- completed_round_number N → unlock round N+1 after required_continuation_requests

INSERT INTO round_unlock_rules (
  completed_round_number,
  required_continuation_requests,
  reward_amount_per_participant,
  active_from
) VALUES
  (1, 25, 1000.00, now()),
  (2, 50, 2000.00, now()),
  (3, 100, 4000.00, now()),
  (4, 250, 8000.00, now()),
  (5, 500, 12000.00, now());

-- Round 6+: küszöb duplázódik — szabály rekordok runtime / későbbi migráció
