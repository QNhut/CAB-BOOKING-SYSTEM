# Last Test Run Summary

Ngày chạy: `2026-04-26`

## Commands executed
- `node qa-tests/run-pdf-auto-cases.mjs`
- `node qa-tests/payment-pricing.test.mjs`

## Result snapshot

### PDF auto cases
- Passed: `27`
- Failed: `2`

Pass:
- `TC01` register user
- `TC02` login JWT
- `TC03` create booking
- `TC05` driver online
- `TC06` booking initial status
- `TC07` ETA > 0
- `TC08` pricing valid
- `TC10` logout
- `TC10` refresh revoked token
- `TC11` missing pickup
- `TC12` invalid lat/lng
- `TC14` invalid payment method on booking
- `TC14b` invalid payment method on payment API
- `TC15` ETA distance = 0
- `TC16` pricing demand = 0
- `TC17` fraud missing field
- `TC18` unauthorized request
- `TC19` duplicate booking idempotency
- `TC20` payload too large
- `TC42` surge > 1 when demand high
- `TC45` forecast schema
- `TC46` model version
- `TC50` outlier input does not crash ETA
- `TC83/92` tampered JWT
- `TC84/89/95` RBAC forbidden
- plus setup steps `Register driver`, `Driver login`

Fail:
- `TC04` current user booking view
  - Current endpoint `/bookings/me/active` only returns statuses in `PAID`, `MATCHED`, `WAITING_PAYMENT`, `DRIVER_ASSIGNED`.
  - Newly created CASH booking stays `REQUESTED`, so it is not returned by this endpoint.
- `TC43` fraud flagged
  - Current fraud rules produce a score below threshold for the tested payload, so `flagged` remains `false`.

### Existing payment/pricing QA script
- Pricing cases: all pass
- Payment API cases: all pass
- Booking/payment rollback case: fail
  - `booking flow: payment failure cancels VNPAY booking`
  - Cause: the script still assumes a VNPAY booking can be created before payment.
  - Current business logic was changed so VNPAY bookings are created only after successful VNPay verification.

## Conclusion
- The majority of API-checkable PDF cases in the auto bucket are already passing.
- The remaining direct failures are:
  - `TC04` due to endpoint/contract mismatch
  - `TC43` due to fraud scoring not reaching threshold
- One legacy QA script case is obsolete under the new VNPAY flow and should be updated, not treated as a regression by itself.
