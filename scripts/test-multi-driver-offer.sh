#!/bin/bash

# Test: Multi-driver Offer/Reject/Timeout Flow
# Test Case A: Reject flow - d1 rejects -> d2 receives offer
# Test Case B: Timeout flow - d1 timeout -> d2 receives offer

echo "=== MULTI-DRIVER OFFER FLOW TEST ==="
echo "Test Case A: Reject flow"
echo "Test Case B: Timeout flow"
echo ""

# Configuration
DRIVER_URL="http://localhost:8004"
BOOKING_URL="http://localhost:8003"
PRICING_URL="http://localhost:8006"
RIDE_URL="http://localhost:8005"
NOTIFICATION_URL="http://localhost:8007"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==========================================
# STEP 1: Setup 2 Drivers
# ==========================================

echo -e "\n${YELLOW}=== STEP 1: Setup 2 Drivers ONLINE ===${NC}"

echo -e "\nSetting up Driver d1..."
curl -X POST "$DRIVER_URL/drivers/me/status" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d1" \
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}' \
  -s | jq -r '. | "  Status: \(.status), VehicleType: \(.vehicleType)"'

curl -X POST "$DRIVER_URL/drivers/me/location" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d1" \
  -d '{"lat":10.762622,"lng":106.660172,"accuracyM":10}' \
  -s | jq -r '.stored | "  Location: \(.lat), \(.lng)"'

echo -e "\nSetting up Driver d2..."
curl -X POST "$DRIVER_URL/drivers/me/status" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}' \
  -s | jq -r '. | "  Status: \(.status), VehicleType: \(.vehicleType)"'

curl -X POST "$DRIVER_URL/drivers/me/location" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -d '{"lat":10.763200,"lng":106.661000,"accuracyM":10}' \
  -s | jq -r '.stored | "  Location: \(.lat), \(.lng)"'

# Verify nearby query
echo -e "\nVerify nearby drivers..."
NEARBY=$(curl -s "$DRIVER_URL/drivers/nearby?lat=10.762622&lng=106.660172&radiusM=3000&vehicleType=CAR_4&limit=10")
echo "$NEARBY" | jq -r '.drivers | "  Found \(length) drivers:"'
echo "$NEARBY" | jq -r '.drivers[] | "    - \(.driverId) at \(.distanceM)m"'

DRIVER_COUNT=$(echo "$NEARBY" | jq -r '.drivers | length')
if [ "$DRIVER_COUNT" -lt 2 ]; then
    echo -e "${RED}  ERROR: Need at least 2 drivers for multi-offer test!${NC}"
    exit 1
fi

echo -e "${GREEN}OK - Both drivers ready${NC}"

# ==========================================
# STEP 2: Get Price Estimate
# ==========================================

echo -e "\n${YELLOW}=== STEP 2: Get Price Estimate ===${NC}"

ESTIMATE=$(curl -X POST "$PRICING_URL/pricing/estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "pickup": {"lat":10.762622,"lng":106.660172},
    "dropoff": {"lat":10.770000,"lng":106.670000},
    "vehicleType": "CAR_4"
  }' -s)

PRICE=$(echo "$ESTIMATE" | jq -r '.estimatedPrice')
echo -e "  Estimated price: ${GREEN}$PRICE${NC}"

# ==========================================
# HELPER FUNCTIONS
# ==========================================

get_ride_by_booking() {
    local booking_id=$1
    docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
      "SELECT id, booking_id, status, driver_id, current_offer_driver_id, candidate_index FROM rides WHERE booking_id='$booking_id'" -t
}

get_ride_offers() {
    local ride_id=$1
    docker exec -i taxi_postgres psql -U taxi -d ride_db -c \
      "SELECT id, driver_id, status, responded_at FROM ride_offers WHERE ride_id='$ride_id' ORDER BY created_at"
}

# ==========================================
# TEST CASE A: REJECT FLOW
# ==========================================

echo -e "\n${CYAN}=== TEST CASE A: REJECT FLOW ===${NC}"
echo "Scenario: d1 receives offer -> d1 rejects -> d2 receives offer -> d2 accepts"

echo -e "\nCreating booking..."
BOOKING=$(curl -X POST "$BOOKING_URL/bookings" \
  -H "Content-Type: application/json" \
  -H "x-user-id: u1" \
  -d "{
    \"userId\": \"u1\",
    \"pickup\": {\"lat\":10.762622,\"lng\":106.660172},
    \"dropoff\": {\"lat\":10.770000,\"lng\":106.670000},
    \"vehicleType\": \"CAR_4\",
    \"estimatedPrice\": $PRICE
  }" -s)

BOOKING_ID=$(echo "$BOOKING" | jq -r '.bookingId')
echo -e "  Booking created: ${GREEN}$BOOKING_ID${NC}"

# Wait for matching
echo -e "\nWaiting for driver matching (3s)..."
sleep 3

# Check ride record
echo -e "\nChecking ride record..."
RIDE_INFO=$(get_ride_by_booking "$BOOKING_ID")
echo "$RIDE_INFO"

# Extract ride ID
RIDE_ID=$(echo "$RIDE_INFO" | awk '{print $1}' | xargs)
echo -e "  Ride ID: ${GREEN}$RIDE_ID${NC}"

# Show initial offer
echo -e "\nCurrent offers:"
get_ride_offers "$RIDE_ID"

# Simulate d1 REJECT
echo -e "\nSimulating Driver d1 REJECT..."
curl -X POST "$RIDE_URL/rides/$RIDE_ID/driver/reject" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d1" \
  -s | jq -r '. | "  d1 rejected: \(.ok)"'

# Wait for next offer
echo -e "\nWaiting for offer to d2 (2s)..."
sleep 2

# Check offers again
echo -e "\nOffers after d1 reject:"
get_ride_offers "$RIDE_ID"

# Simulate d2 ACCEPT
echo -e "\nSimulating Driver d2 ACCEPT..."
ACCEPT=$(curl -X POST "$RIDE_URL/rides/$RIDE_ID/driver/accept" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -s)
echo "$ACCEPT" | jq -r '. | "  d2 accepted: \(.ok), status: \(.status)"'

# Final state
echo -e "\nFinal ride state:"
get_ride_by_booking "$BOOKING_ID"

echo -e "\nFinal offers:"
get_ride_offers "$RIDE_ID"

echo -e "\n${GREEN}=== TEST CASE A: COMPLETED ===${NC}"
echo "Expected: d1 REJECTED -> d2 ACCEPTED -> Ride DRIVER_ASSIGNED"

# ==========================================
# CLEANUP & PREPARE FOR TEST CASE B
# ==========================================

echo -e "\n${YELLOW}=== Cleanup for Test Case B ===${NC}"

echo "Resetting drivers to ONLINE..."
curl -X POST "$DRIVER_URL/drivers/me/status" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d1" \
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}' -s > /dev/null

curl -X POST "$DRIVER_URL/drivers/me/status" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -d '{"status":"ONLINE","vehicleType":"CAR_4"}' -s > /dev/null

# Update locations again (refresh heartbeat)
curl -X POST "$DRIVER_URL/drivers/me/location" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d1" \
  -d '{"lat":10.762622,"lng":106.660172,"accuracyM":10}' -s > /dev/null

curl -X POST "$DRIVER_URL/drivers/me/location" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -d '{"lat":10.763200,"lng":106.661000,"accuracyM":10}' -s > /dev/null

echo -e "${GREEN}Drivers reset${NC}"

# ==========================================
# TEST CASE B: TIMEOUT FLOW
# ==========================================

echo -e "\n${CYAN}=== TEST CASE B: TIMEOUT FLOW ===${NC}"
echo "Scenario: d1 receives offer -> d1 timeout -> d2 receives offer -> d2 accepts"

TIMEOUT_SEC=10
echo -e "${YELLOW}OFFER_TIMEOUT_SEC = $TIMEOUT_SEC seconds (configured in ride-service)${NC}"

echo -e "\nCreating second booking..."
BOOKING2=$(curl -X POST "$BOOKING_URL/bookings" \
  -H "Content-Type: application/json" \
  -H "x-user-id: u1" \
  -d "{
    \"userId\": \"u1\",
    \"pickup\": {\"lat\":10.762622,\"lng\":106.660172},
    \"dropoff\": {\"lat\":10.770000,\"lng\":106.670000},
    \"vehicleType\": \"CAR_4\",
    \"estimatedPrice\": $PRICE
  }" -s)

BOOKING_ID2=$(echo "$BOOKING2" | jq -r '.bookingId')
echo -e "  Booking created: ${GREEN}$BOOKING_ID2${NC}"

# Wait for matching
echo -e "\nWaiting for driver matching (3s)..."
sleep 3

# Check ride record
echo -e "\nChecking ride record..."
RIDE_INFO2=$(get_ride_by_booking "$BOOKING_ID2")
echo "$RIDE_INFO2"

# Extract ride ID
RIDE_ID2=$(echo "$RIDE_INFO2" | awk '{print $1}' | xargs)
echo -e "  Ride ID: ${GREEN}$RIDE_ID2${NC}"

# Show initial offer
echo -e "\nCurrent offers (d1 should be offered):"
get_ride_offers "$RIDE_ID2"

# Wait for timeout
echo -e "\n${YELLOW}Waiting for timeout ($TIMEOUT_SEC seconds)...${NC}"
echo "Driver d1 will NOT respond (simulating timeout)"
sleep $((TIMEOUT_SEC + 3))

# Check offers after timeout
echo -e "\nOffers after timeout:"
get_ride_offers "$RIDE_ID2"

echo -e "\nRide state after timeout:"
get_ride_by_booking "$BOOKING_ID2"

# Simulate d2 ACCEPT
echo -e "\nSimulating Driver d2 ACCEPT..."
ACCEPT2=$(curl -X POST "$RIDE_URL/rides/$RIDE_ID2/driver/accept" \
  -H "Content-Type: application/json" \
  -H "x-driver-id: d2" \
  -s)
echo "$ACCEPT2" | jq -r '. | "  d2 accepted: \(.ok), status: \(.status)"'

# Final state
echo -e "\nFinal ride state:"
get_ride_by_booking "$BOOKING_ID2"

echo -e "\nFinal offers:"
get_ride_offers "$RIDE_ID2"

echo -e "\n${GREEN}=== TEST CASE B: COMPLETED ===${NC}"
echo "Expected: d1 TIMEOUT -> d2 OFFERED -> d2 ACCEPTED -> Ride DRIVER_ASSIGNED"

# ==========================================
# SUMMARY
# ==========================================

echo -e "\n${CYAN}=== TEST SUMMARY ===${NC}"

echo -e "\nTest Case A (Reject flow):"
echo "  Booking ID: $BOOKING_ID"
echo "  Ride ID: $RIDE_ID"
echo "  Flow: d1 offered -> d1 rejected -> d2 offered -> d2 accepted"

echo -e "\nTest Case B (Timeout flow):"
echo "  Booking ID: $BOOKING_ID2"
echo "  Ride ID: $RIDE_ID2"
echo "  Flow: d1 offered -> timeout -> d2 offered -> d2 accepted"

echo -e "\nTo verify SSE events, open these URLs in browser:"
echo "  Driver d1 SSE: http://localhost:8007/notifications/stream?role=DRIVER&driverId=d1"
echo "  Driver d2 SSE: http://localhost:8007/notifications/stream?role=DRIVER&driverId=d2"
echo "  User u1 SSE: http://localhost:8007/notifications/stream?role=USER&userId=u1"

echo -e "\nTo check Kafka events:"
echo '  docker exec -it taxi_kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic taxi.events --from-beginning --max-messages 50'

echo ""
