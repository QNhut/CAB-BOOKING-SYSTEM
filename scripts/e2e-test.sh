#!/bin/bash
set -euo pipefail
BASE="http://localhost:8000"

echo "========================================="
echo "   FULL E2E FLOW VERIFICATION"
echo "========================================="

# 1. Register or login customer
echo ""
echo "=== 1. Register/Login Customer ==="
CUST=$(curl -s --max-time 5 -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d '{"identifier":"e2e_cust@test.com","password":"123456","role":"USER","userId":"u_e2e2"}' 2>/dev/null)
CTOKEN=$(echo "$CUST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || true)
if [ -z "$CTOKEN" ]; then
  CUST=$(curl -s --max-time 5 -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d '{"identifier":"e2e_cust@test.com","password":"123456","userId":"u_e2e2"}')
  CTOKEN=$(echo "$CUST" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
fi
echo "Customer token obtained: ${CTOKEN:0:20}..."

# 2. Register or login driver
echo ""
echo "=== 2. Register/Login Driver ==="
DRV=$(curl -s --max-time 5 -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d '{"identifier":"e2e_drv@test.com","password":"123456","role":"DRIVER","driverId":"d_e2e2"}' 2>/dev/null)
DTOKEN=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || true)
if [ -z "$DTOKEN" ]; then
  DRV=$(curl -s --max-time 5 -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d '{"identifier":"e2e_drv@test.com","password":"123456","driverId":"d_e2e2"}')
  DTOKEN=$(echo "$DRV" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
fi
echo "Driver token obtained: ${DTOKEN:0:20}..."

# 3. Driver go online
echo ""
echo "=== 3. Driver Go Online ==="
curl -s --max-time 5 -X POST "$BASE/drivers/me/status" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $DTOKEN" \
  -d '{"status":"ONLINE","lat":10.7769,"lng":106.7009,"vehicleType":"CAR_4"}'
echo ""

# 4. Update driver location
echo ""
echo "=== 4. Update Driver Location ==="
curl -s --max-time 5 -X POST "$BASE/drivers/me/location" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $DTOKEN" \
  -d '{"lat":10.7770,"lng":106.7010,"accuracyM":5}'
echo ""

# 5. Pricing estimate
echo ""
echo "=== 5. Pricing Estimate ==="
PRICING=$(curl -s --max-time 10 -X POST "$BASE/pricing/estimate" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.7769,"lng":106.7009},"dropoff":{"lat":10.8231,"lng":106.6297},"vehicleType":"CAR_4"}')
echo "$PRICING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Fare: {d[\"fare\"]} VND, Distance: {d[\"distanceM\"]}m')"
FARE=$(echo "$PRICING" | python3 -c "import sys,json; print(json.load(sys.stdin)['fare'])")
DIST=$(echo "$PRICING" | python3 -c "import sys,json; print(json.load(sys.stdin)['distanceM'])")
DUR=$(echo "$PRICING" | python3 -c "import sys,json; print(json.load(sys.stdin)['durationS'])")

# 6. Create booking
echo ""
echo "=== 6. Create Booking ==="
IDEM="e2e-$(date +%s)"
BOOKING=$(curl -s --max-time 10 -X POST "$BASE/bookings" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $CTOKEN" \
  -H "X-Idempotency-Key: $IDEM" \
  -d "{\"userId\":\"u_e2e2\",\"pickup\":{\"lat\":10.7769,\"lng\":106.7009},\"dropoff\":{\"lat\":10.8231,\"lng\":106.6297},\"vehicleType\":\"CAR_4\",\"paymentMethod\":\"CASH\",\"pricingSnapshot\":{\"fare\":$FARE,\"distanceM\":$DIST,\"durationS\":$DUR}}")
echo "$BOOKING"
BID=$(echo "$BOOKING" | python3 -c "import sys,json; print(json.load(sys.stdin)['bookingId'])")
echo "BookingId: $BID"

# 7. Wait for ride assignment
echo ""
echo "=== 7. Waiting 3s for ride assignment ==="
sleep 3

# 8. Driver check ride offer
echo ""
echo "=== 8. Driver Check Ride Offer ==="
RIDER=$(curl -s --max-time 5 "$BASE/drivers/me/rides/current" -H "Authorization: Bearer $DTOKEN")
echo "$RIDER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Type: {d.get(\"type\",\"?\")}')"
RID=$(echo "$RIDER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ride',{}).get('id',''))" 2>/dev/null || true)

if [ -n "$RID" ] && [ "$RID" != "" ] && [ "$RID" != "None" ]; then
  echo "RideId: $RID"

  echo ""
  echo "=== 9. Driver Accept Ride ==="
  curl -s --max-time 5 -X POST "$BASE/rides/$RID/driver/accept" -H "Authorization: Bearer $DTOKEN"
  echo ""

  echo ""
  echo "=== 10. Customer Check Ride ==="
  curl -s --max-time 5 "$BASE/users/me/rides/current" -H "Authorization: Bearer $CTOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d.get(\"ride\",{}).get(\"status\",d.get(\"type\",\"?\"))}')"

  echo ""
  echo "=== 11. Driver Pickup ==="
  curl -s --max-time 5 -X POST "$BASE/rides/$RID/driver/pickup" -H "Authorization: Bearer $DTOKEN"
  echo ""

  echo ""
  echo "=== 12. Driver Complete ==="
  curl -s --max-time 5 -X POST "$BASE/rides/$RID/complete" -H "Authorization: Bearer $DTOKEN"
  echo ""

  echo ""
  echo "=== 13. Submit Review ==="
  curl -s --max-time 5 -X POST "$BASE/reviews" -H "Content-Type: application/json" \
    -d "{\"ride_id\":\"$RID\",\"reviewer_id\":\"u_e2e2\",\"reviewer_role\":\"USER\",\"reviewee_id\":\"d_e2e2\",\"rating\":5,\"comment\":\"Great ride\",\"tip_amount\":20000}"
  echo ""

  echo ""
  echo "=== 14. Customer History ==="
  curl -s --max-time 5 "$BASE/bookings/me/history" -H "Authorization: Bearer $CTOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total rides: {len(d.get(\"rides\",[]))}')"

  echo ""
  echo "=== 15. Driver History ==="
  curl -s --max-time 5 "$BASE/drivers/me/rides/history" -H "Authorization: Bearer $DTOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total rides: {len(d.get(\"rides\",[]))}')"
else
  echo "WARNING: No ride offer received"
fi

echo ""
echo "========================================="
echo "   E2E FLOW COMPLETE"
echo "========================================="
