# Cab Booking Project Testcase Report

Nguon tong hop:
- `final_PROJECT_grading-factor.pdf`
- `qa-tests/TESTCASE_CLASSIFICATION_FROM_PDF.md`
- `qa-tests/NON_API_DEMO_SCENARIOS.md`
- `qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_collection.json`
- cac script trong `qa-tests/`

Ngay cap nhat: `2026-04-27`

## Legend
- `PASS`: da test va verify bang runtime, Postman, script, hoac observability.
- `READY`: da co testcase/script/collection, nhung chua rerun xac nhan lai trong dot tong hop nay.
- `MANUAL`: khong phu hop de chung minh bang API thuần; can demo bang log, SSE, Grafana, Jaeger, Docker/K8s, hoac fault injection.
- `CHUA PASS`: da xac dinh chua dat theo tieu chi hoac local stack hien tai chua co ha tang/logic can thiet.

## Final rerun summary

- Moi truong: `docker compose -f docker-compose.dev.yml up -d`
- PDF auto suite:
  - lenh: `BASE_URL=http://127.0.0.1:8000 node qa-tests/run-pdf-auto-cases.mjs`
  - ket qua: `28 PASS / 1 FAIL`
  - fail duy nhat: `TC04 current user booking view` -> `active booking mismatch`
- Payment/Pricing regression suite:
  - lenh: `node qa-tests/payment-pricing.test.mjs`
  - ket qua: `10/10 PASS`
- Functional/agent/resilience scripts rerun:
  - `TC30`, `TC35`, `TC36`, `TC37`, `TC38`, `TC39`, `TC47`, `TC48`, `TC49`, `TC52`, `TC53`, `TC54`, `TC55`, `TC56`, `TC59`, `TC71`, `TC75`, `TC77`, `TC80`, `TC116`, `TC117`, `TC118` -> `PASS`
- Load/metrics scripts rerun:
  - `TC61`, `TC62`, `TC63`, `TC64`, `TC65`, `TC66`, `TC67`, `TC69` -> `PASS`
  - `TC68` -> `FAIL` (`p95_ms=802` voi nguong `< 300ms`)

## 1. PASS da verify runtime

Tat ca testcase sau da pass trong cac dot rerun gan nhat:

`TC01`, `TC02`, `TC03`, `TC05`, `TC06`, `TC07`, `TC08`, `TC10`, `TC11`, `TC12`, `TC14`, `TC15`, `TC16`, `TC17`, `TC18`, `TC19`, `TC20`, `TC29`, `TC30`, `TC32`, `TC33`, `TC34`, `TC35`, `TC36`, `TC37`, `TC38`, `TC39`, `TC40`, `TC41`, `TC42`, `TC43`, `TC44`, `TC45`, `TC46`, `TC47`, `TC48`, `TC49`, `TC51`, `TC52`, `TC53`, `TC54`, `TC55`, `TC56`, `TC57`, `TC58`, `TC59`, `TC60`, `TC61`, `TC62`, `TC63`, `TC64`, `TC65`, `TC66`, `TC67`, `TC69`, `TC71`, `TC72`, `TC75`, `TC76`, `TC77`, `TC80`, `TC81`, `TC82`, `TC83`, `TC84`, `TC85`, `TC86`, `TC90`, `TC91`, `TC93`, `TC96`, `TC98`, `TC102`, `TC111`, `TC112`, `TC113`, `TC114`, `TC115`, `TC116`, `TC117`, `TC118`.

Cach test nhom `PASS`:
- `Postman/API`: `TC01`, `TC02`, `TC03`, `TC05`, `TC06`, `TC07`, `TC08`, `TC10`, `TC11`, `TC12`, `TC14`, `TC15`, `TC16`, `TC17`, `TC18`, `TC19`, `TC20`, `TC29`, `TC42`, `TC43`, `TC44`, `TC45`, `TC46`, `TC83`, `TC84`, `TC91`, `TC93`, `TC96`, `TC102`, `TC113`.
- `Flow/agent/resilience scripts`: `TC30`, `TC32`, `TC33`, `TC34`, `TC35`, `TC36`, `TC37`, `TC38`, `TC39`, `TC40`, `TC41`, `TC47`, `TC48`, `TC49`, `TC51`, `TC52`, `TC53`, `TC54`, `TC55`, `TC56`, `TC57`, `TC58`, `TC59`, `TC60`, `TC71`, `TC72`, `TC75`, `TC76`, `TC77`, `TC80`, `TC118`.
- `Load/metrics/security scripts`: `TC61`, `TC62`, `TC63`, `TC64`, `TC65`, `TC66`, `TC67`, `TC69`, `TC81`, `TC82`, `TC85`, `TC86`, `TC90`, `TC98`, `TC116`, `TC117`.
- `Observability/manual verified`: `TC111`, `TC112`, `TC114`, `TC115`.

Huong dan test chi tiet nhom `PASS`:

- `Postman/API`
  1. Import collection:
     - `qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_collection.json`
     - `qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_environment.json`
  2. Chay `00 Setup` de tao user/driver/token.
  3. Chay tung folder testcase hoac dung Collection Runner cho cac case API thuan.
  4. Cac case thuoc nhom nay thuong pass khi:
     - HTTP status dung
     - response schema dung
     - test script trong Postman mau xanh.
  5. Cac TC nen rerun bang Postman khi demo:
     - `TC01`, `TC02`, `TC03`, `TC05`, `TC06`, `TC07`, `TC08`
     - `TC10`, `TC11`, `TC12`, `TC14`, `TC15`, `TC16`, `TC17`, `TC18`, `TC19`, `TC20`
     - `TC29`, `TC42`, `TC43`, `TC44`, `TC45`, `TC46`
     - `TC83`, `TC84`, `TC91`, `TC93`, `TC96`, `TC102`, `TC113`

- `PDF auto suite`
  1. Chay:
     ```powershell
     $env:BASE_URL="http://127.0.0.1:8000"
     node qa-tests/run-pdf-auto-cases.mjs
     ```
  2. Suite nay bao phu mot phan lon cac case API thuan trong nhom `PASS`.
  3. Dieu kien pass:
     - script in `PASS`
     - khong co exception.

- `Payment/Pricing regression`
  1. Chay:
     ```powershell
     node qa-tests/payment-pricing.test.mjs
     ```
  2. Bao phu:
     - pricing valid/surge/fallback validation
     - payment valid/invalid/idempotency
     - booking compensation flow lien quan payment fail.

- `Flow/agent/resilience scripts`
  1. Chay tung script theo testcase can demo.
  2. Cac lenh mau:
     ```powershell
     node qa-tests/tc30-pricing-timeout-retry.mjs
     node qa-tests/tc35-concurrent-booking.mjs
     node qa-tests/tc36-saga-success.mjs
     node qa-tests/tc37-saga-failure-compensation.mjs
     node qa-tests/tc38-kafka-outbox-consistency.mjs
     node qa-tests/tc39-payment-timeout-partial-failure.mjs
     node qa-tests/tc47-agent-latency.mjs
     node qa-tests/tc48-drift-detection.mjs
     node qa-tests/tc49-agent-fallback.mjs
     node qa-tests/tc52-agent-rating.mjs
     node qa-tests/tc53-agent-balance.mjs
     node qa-tests/tc54-agent-tools.mjs
     node qa-tests/tc55-agent-missing-context.mjs
     node qa-tests/tc56-agent-retry.mjs
     node qa-tests/tc59-agent-concurrency.mjs
     node qa-tests/tc71-driver-cache-fallback.mjs
     node qa-tests/tc75-circuit-breaker.mjs
     node qa-tests/tc77-retry-backoff.mjs
     node qa-tests/tc80-graceful-degradation.mjs
     node qa-tests/tc118-ai-monitoring.mjs
     ```
  3. Dieu kien pass:
     - script exit code `0`
     - stdout co thong tin mong doi: `PASS`, `selected_driver`, `firing`, `hit_rate`, `CANCELLED`, `SENT`, `OPEN` tuy case.

- `Load/metrics/security scripts`
  1. Chay:
     ```powershell
     node qa-tests/tc61-booking-load.mjs
     node qa-tests/tc62-eta-load.mjs
     node qa-tests/tc63-pricing-spike.mjs
     node qa-tests/tc64-kafka-throughput.mjs
     node qa-tests/tc65-db-pool-exhaustion.mjs
     node qa-tests/tc66-cache-hit-rate.mjs
     node qa-tests/tc67-api-gateway-rate-limit.mjs
     node qa-tests/tc69-peak-hour-load.mjs
     node qa-tests/tc116-error-alert.mjs
     node qa-tests/tc117-latency-alert.mjs
     ```
  2. Security test co the rerun bang:
     ```powershell
     node qa-tests/run-pdf-auto-cases.mjs
     node qa-tests/payment-pricing.test.mjs
     ```
     hoac Postman cho `TC81`, `TC82`, `TC85`, `TC86`, `TC90`, `TC98`.
  3. Dieu kien pass:
     - load scripts in `200`, `201`, `429`, `achieved_rps`, `hit_rate` dung ky vong
     - alert scripts in `rule_state=firing` hoac `pending` theo rule da thiet ke.

- `Observability/manual verified`
  1. `TC111`, `TC112`:
     - goi API chinh
     - mo log service
     - kiem tra log JSON co `timestamp`, `service_name`, `level`, `request_id`, `trace_id`.
  2. `TC114`:
     - mo `http://localhost:3000`
     - login `admin/admin`
     - vao dashboard `Cab Booking System Dashboard`
     - kiem tra `Request Rate`, `P95/P99`, `Error Rate`.
  3. `TC115`:
     - goi:
       ```powershell
       curl -X POST http://localhost:8000/agent/booking-flow-trace -H "Content-Type: application/json" -d "{\"booking_id\":\"BKTRACE1\",\"user_id\":\"USR123\",\"pickup\":{\"lat\":10.76,\"lng\":106.66},\"dropoff\":{\"lat\":10.77,\"lng\":106.70},\"vehicleType\":\"CAR_4\",\"payment_method\":\"card\",\"amount\":50000,\"card_number\":\"4111111111111234\"}"
       ```
     - mo `http://localhost:16686`
     - tim trace vua tao, kiem tra span qua `api-gateway`, `agent-service`, `eta-service`, `pricing-service`, `payment-service`.

Lenh tong hop de rerun nhanh nhom `PASS` neu can:

```powershell
node qa-tests/run-pdf-auto-cases.mjs
node qa-tests/payment-pricing.test.mjs
node qa-tests/tc30-pricing-timeout-retry.mjs
node qa-tests/tc35-concurrent-booking.mjs
node qa-tests/tc36-saga-success.mjs
node qa-tests/tc37-saga-failure-compensation.mjs
node qa-tests/tc38-kafka-outbox-consistency.mjs
node qa-tests/tc39-payment-timeout-partial-failure.mjs
node qa-tests/tc47-agent-latency.mjs
node qa-tests/tc48-drift-detection.mjs
node qa-tests/tc49-agent-fallback.mjs
node qa-tests/tc52-agent-rating.mjs
node qa-tests/tc53-agent-balance.mjs
node qa-tests/tc54-agent-tools.mjs
node qa-tests/tc55-agent-missing-context.mjs
node qa-tests/tc56-agent-retry.mjs
node qa-tests/tc59-agent-concurrency.mjs
node qa-tests/tc61-booking-load.mjs
node qa-tests/tc62-eta-load.mjs
node qa-tests/tc63-pricing-spike.mjs
node qa-tests/tc64-kafka-throughput.mjs
node qa-tests/tc65-db-pool-exhaustion.mjs
node qa-tests/tc66-cache-hit-rate.mjs
node qa-tests/tc67-api-gateway-rate-limit.mjs
node qa-tests/tc69-peak-hour-load.mjs
node qa-tests/tc71-driver-cache-fallback.mjs
node qa-tests/tc75-circuit-breaker.mjs
node qa-tests/tc77-retry-backoff.mjs
node qa-tests/tc80-graceful-degradation.mjs
node qa-tests/tc116-error-alert.mjs
node qa-tests/tc117-latency-alert.mjs
node qa-tests/tc118-ai-monitoring.mjs
```

So lieu rerun dang chu y trong nhom `PASS`:
- `TC61`: `200=60`, `achieved_rps=22.19`
- `TC62`: `200=120`, `achieved_rps=99.75`
- `TC63`: `200=120` o phase spike
- `TC64`: `201=80`, `achieved_rps=63.14`
- `TC65`: `200=120`, he thong khong crash
- `TC66`: `eta_hit_rate=0.9918`, `pricing_hit_rate=0.975`
- `TC67`: `429=221`
- `TC69`: `200=300`, `achieved_rps=93.81`

## 2. READY da co testcase/collection, nhung chua verify lai trong dot tong hop nay

- `TC09` Notification gui thanh cong
  Cach test chi tiet:
  1. Mo tab SSE rieng:
     - `GET http://localhost:8000/notifications/stream?token={{customerToken}}`
  2. Tao mot flow phat sinh notification:
     - booking moi
     - payment success/fail
     - ride offer/ride matched.
  3. Quan sat tab SSE:
     - phai nhan event moi.
  4. Neu can:
     - goi `GET /notifications/debug`
     - mo log `notification-service`.
- `TC13` Driver offline khong nhan booking
  Cach test chi tiet:
  1. Chay request `TC13 - Driver Goes OFFLINE`.
  2. Tao booking moi cho user.
  3. Poll:
     - `GET /drivers/me/rides/current`
     - `GET /bookings/{bookingId}`
  4. Quan sat log `ride-service`.
  5. Dieu kien pass:
     - driver offline khong nhan offer.
- `TC21` Booking goi ETA service
  Cach test chi tiet:
  1. Goi request ETA support trong collection.
  2. Goi `POST /eta/predict` bang input booking.
  3. Sau do tao booking bang `pricingSnapshot` tu ket qua da tinh.
  4. Giai thich mapping hien tai:
     - booking service khong tu goi ETA noi bo trong luong create.
- `TC22` Booking goi Pricing service
  Cach test chi tiet:
  1. Goi `POST /pricing/estimate`.
  2. Lay `fare`, `distanceM`, `durationS`.
  3. Tao booking voi `pricingSnapshot` do.
  4. Giai thich mapping hien tai:
     - booking nhan ket qua pricing tu client.
- `TC23` AI Agent chon driver tu Driver Service
  Cach test chi tiet:
  1. Dang ky/login driver.
  2. Cho driver `ONLINE`.
  3. Tao booking moi.
  4. Poll `GET /drivers/me/rides/current`.
  5. Neu can, mo `GET /agent/decisions` de xem decision.
- `TC24` Booking -> Payment -> Notification flow
  Cach test chi tiet:
  1. Mo SSE user trong tab rieng.
  2. Chay folder `TC24` theo thu tu.
  3. Kiem tra:
     - booking duoc tao
     - payment thanh cong
     - event notification day ve SSE.
- `TC25` Kafka event `ride_requested`
  Cach test chi tiet:
  1. Tao booking moi.
  2. Mo logs:
     - `ride-service`
     - `notification-service`
  3. Tim log publish/consume lien quan `ride_requested`.
- `TC26` Driver nhan notification
  Cach test chi tiet:
  1. Mo SSE stream cua driver.
  2. Cho driver `ONLINE`.
  3. Tao booking.
  4. Quan sat driver nhan event offer.
- `TC27` Booking update `ACCEPTED`
  Cach test chi tiet:
  1. Poll ride hien tai cua driver de lay `rideId`.
  2. Goi request accept.
  3. Goi `GET /bookings/{bookingId}`.
  4. Dieu kien pass:
     - booking thanh `MATCHED` hoac state tuong duong.
- `TC28` MCP context fetch thanh cong
  Cach test chi tiet:
  1. Chay `TC28 - MCP Context Fetch Success`.
  2. Kiem tra response co:
     - `available_drivers`
     - `eta`
     - `pricing`
     - `tools_called`.
- `TC31` Transaction tao booking thanh cong
  Cach test chi tiet:
  1. Tao booking hop le.
  2. Luu `bookingId`.
  3. Goi `GET /bookings/{bookingId}`.
  4. Kiem tra row ton tai va field chinh day du.
- `TC50` Input bat thuong model khong crash
  Cach test chi tiet:
  1. Chay `TC50 - Outlier Input Does Not Crash ETA`.
  2. Payload su dung `distance_km` rat lon.
  3. Dieu kien pass:
     - service tra response hop le hoac validation error co kiem soat
     - container khong crash.
- `TC89` RBAC enforcement
  Cach test chi tiet:
  1. Dung token `USER` hoac `DRIVER`.
  2. Goi endpoint admin/protected.
  3. Dieu kien pass:
     - `403 Forbidden`
     - khong tra du lieu nhay cam.
- `TC92` Token khong hop le
  Cach test chi tiet:
  1. Dung JWT da sua signature.
  2. Goi endpoint protected.
  3. Dieu kien pass:
     - `401`
     - message token invalid/tampered.
- `TC95` User khong co quyen
  Cach test chi tiet:
  1. Dung token role khong du quyen.
  2. Goi endpoint danh cho role khac.
  3. Dieu kien pass:
     - `403`
     - khong co side effect.
- `TC100` Audit logging
  Cach test chi tiet:
  1. Dang nhap user.
  2. Goi protected API, vi du tao booking.
  3. Mo logs `auth-service` va `booking-service`.
  4. Quan sat:
     - `timestamp`
     - `service_name`
     - actor/action
     - status
     - `request_id` / `trace_id`.
- `TC101` Deploy service thanh cong
  Cach test chi tiet:
  1. Chay `docker compose -f docker-compose.dev.yml up -d`.
  2. Kiem tra `docker compose ... ps`.
  3. Goi `GET /health` cho service chinh.
- `TC103` Environment variables dung
  Cach test chi tiet:
  1. Mo `.env` va `docker-compose.dev.yml`.
  2. Doi chieu bien:
     - `JWT_SECRET`
     - `DATABASE_URL`
     - `KAFKA_BROKERS`
     - `REDIS_URL`.
  3. Xem startup log de chac chan service len dung.
- `TC104` Service connect database
  Cach test chi tiet:
  1. Goi `GET /health`.
  2. Goi API truy DB:
     - auth login/register
     - booking lookup.
  3. Dieu kien pass:
     - khong co loi DB connection.
- `TC105` Service connect Kafka
  Cach test chi tiet:
  1. Trigger flow co publish event:
     - booking
     - payment
     - ride accept.
  2. Mo logs producer/consumer.
  3. Dieu kien pass:
     - co log publish
     - co log consume.
- `TC109` Config sai -> fail fast
  Cach test chi tiet:
  1. Sua tam bien moi truong quan trong sang gia tri sai.
  2. Restart service.
  3. Dieu kien pass:
     - service fail ngay khi start
     - hoac health fail ro rang.
- `TC119` Kafka monitoring
  Cach test chi tiet:
  1. Mo Kafka UI `http://localhost:8080`.
  2. Xem topics, consumer groups.
  3. Doi chieu voi logs va metrics neu can.
- `TC120` Resource monitoring CPU/Memory
  Cach test chi tiet:
  1. Mo Grafana/Prometheus neu co panel resource.
  2. Hoac chay `docker stats`.
  3. Quan sat CPU/Memory khi chay flow hoac load test.

## 3. MANUAL / INFRA testcases chua phu hop de chot bang API thuan

- `TC51` Agent chon driver gan nhat
  Kich ban test chi tiet:
  1. Goi `POST /agent/select-driver`.
  2. Truyen 3-5 `available_drivers` inline, khoang cach khac nhau.
  3. Kiem tra `selected_driver` trung driver gan nhat.
  4. Neu can, doi chieu them `top_3`.
- `TC52` Agent can nhac rating
  Kich ban test chi tiet:
  1. Tao 2 driver khoang cach gan nhau.
  2. Dat rating mot driver cao hon.
  3. Goi `POST /agent/select-driver`.
  4. Quan sat driver duoc chon.
- `TC53` Agent can bang ETA vs price
  Kich ban test chi tiet:
  1. Gui `available_drivers` co `eta_minutes` va `price`.
  2. Dung 2-3 driver voi tradeoff ETA/gia khac nhau.
  3. Goi `POST /agent/select-driver`.
  4. Kiem tra ket qua phu hop score can bang.
- `TC54` Agent goi dung tool
  Kich ban test chi tiet:
  1. Goi `POST /agent/context` hoac `POST /agent/booking-flow-trace`.
  2. Kiem tra `tools_called` trong response.
  3. Mo Jaeger va tim trace.
  4. Xac nhan spans toi `driver-service`, `eta-service`, `pricing-service`.
- `TC55` Agent xu ly context thieu du lieu
  Kich ban test chi tiet:
  1. Bo `demand_index`, `supply_index`, `traffic_level`, hoac mot so optional field.
  2. Goi `POST /agent/context`.
  3. Dieu kien pass:
     - response van `200`
     - co default/fallback
     - khong crash.
- `TC56` Agent retry khi service loi
  Kich ban test chi tiet:
  1. Dung test hook fail-once cho pricing/eta.
  2. Goi `POST /agent/context`.
  3. Kiem tra `attempt`, `retry_delays_ms`, va response cuoi.
- `TC58` Agent log decision day du
  Kich ban test chi tiet:
  1. Trigger mot lan `agent/select-driver`.
  2. Lay `request_id` / `decision_log`.
  3. Goi `GET /agent/decisions/:requestId`.
  4. Kiem tra:
     - selected driver
     - reason
     - score
     - context summary.
- `TC70` Auto scaling hoat dong
  Kich ban test chi tiet:
  1. Can moi truong K8s co HPA/autoscaler.
  2. Dat threshold CPU/RPS.
  3. Tao tai.
  4. Quan sat replica tang bang `kubectl get hpa/pods`.
- `TC73` Kafka down -> buffer event
  Kich ban test chi tiet:
  1. Stop Kafka hoac `booking-worker`.
  2. Tao booking moi.
  3. Goi `GET http://localhost:8003/outbox?status=NEW`.
  4. Kiem tra event van nam trong outbox, khong bi mat.
- `TC74` DB failover
  Kich ban test chi tiet:
  1. Restart `postgres`.
  2. Thu goi lai API truy DB sau khi DB len lai.
  3. Kiem tra service co reconnect/failover hay khong.
- `TC78` Service mesh routing fail
  Kich ban test chi tiet:
  1. Can service mesh/proxy route rule.
  2. Cau hinh route sai co chu dich.
  3. Goi request qua route do.
  4. Quan sat `503` hoac route fallback.
- `TC79` Network partition test
  Kich ban test chi tiet:
  1. Chan network giua 2 service.
  2. Goi flow phu thuoc service do.
  3. Quan sat timeout/retry/degrade, khong treo vo han.
- `TC87` Data encryption at rest
  Kich ban test chi tiet:
  1. Truy cap volume hoac dump DB.
  2. Tim du lieu nhay cam.
  3. Kiem tra no da ma hoa tren dia hoac field-level hay chua.
- `TC88` mTLS communication
  Kich ban test chi tiet:
  1. Chuan bi cert server/client va CA trust.
  2. Goi request hop le voi cert dung.
  3. Goi lai voi cert sai/thieu.
  4. Quan sat mutual verification.
- `TC94` Service-to-service authentication
  Kich ban test chi tiet:
  1. Request noi bo co cert hop le -> pass.
  2. Request noi bo thieu cert/cert sai -> fail.
  3. Quan sat log/proxy layer.
- `TC106` Rolling update
  Kich ban test chi tiet:
  1. Mo mot cua so poll `GET /health` lien tuc.
  2. Roll/update service.
  3. Kiem tra downtime co bang 0 hoac rat nho.
- `TC107` Auto scaling HPA
  Kich ban test chi tiet:
  1. Trinh bay HPA config.
  2. Tao tai.
  3. Quan sat replica tang va giam xuong khi tai ha.
- `TC108` Service mesh routing
  Kich ban test chi tiet:
  1. Mo config route/service mesh.
  2. Goi request qua gateway/proxy.
  3. Chung minh request toi dung backend.
- `TC110` Rollback deployment
  Kich ban test chi tiet:
  1. Deploy version loi co chu dich.
  2. Xac nhan health/smoke fail.
  3. Rollback ve version cu.
  4. Xac nhan health pass lai.

## 4. CHUA PASS hoac chua dat theo local stack hien tai

- `TC04` Lay booking hien tai cua user
  Trang thai: `CHUA PASS` trong final rerun.
  Ket qua gan nhat: `run-pdf-auto-cases` fail voi `active booking mismatch`.
  Cach test chi tiet:
  1. Dang ky/login user moi.
  2. Tao booking `CASH` hop le.
  3. Goi `GET /bookings/me/active` voi token user.
  4. Dieu kien pass:
     - `booking.id` phai trung `bookingId` vua tao.
  5. Ket qua hien tai:
     - response khong match booking vua tao.
  Cach cai thien:
  1. kiem tra logic `GET /bookings/me/active` dang tra booking nao sau khi ride/offer cap nhat nhanh,
  2. neu endpoint chi cho mot subset status, can them `REQUESTED` vao bo loc hoac sua assert theo contract that,
  3. rerun `BASE_URL=http://127.0.0.1:8000 node qa-tests/run-pdf-auto-cases.mjs`.

- `TC68` P95 latency < 300ms
  Trang thai: `CHUA PASS`.
  Ket qua gan nhat: `node qa-tests/tc68-p95-latency.mjs http://127.0.0.1:8009 200 40 300` cho `p95_ms=802`.
  Cach test chi tiet:
  1. Chay `node qa-tests/tc68-p95-latency.mjs http://127.0.0.1:8009 200 40 300`.
  2. Script se in `p95_ms`, `p99_ms`, `statuses`.
  3. Dieu kien pass:
     - `p95_ms < 300`.
  4. Ket qua hien tai:
     - `p95_ms=802`, nen fail.
  Cach cai thien:
  1. toi uu `eta-service` cho duong cache nong,
  2. giam overhead JSON/Redis/trace,
  3. neu can, tach benchmark internal va gateway benchmark.
  Cach test lai: chay lai `node qa-tests/tc68-p95-latency.mjs`.
- `TC97` API Gateway kiem tra tat ca request
  Trang thai: `CHUA PASS`.
  Ly do: nhieu internal service van publish port ra host trong `docker-compose.dev.yml`.
  Cach test chi tiet:
  1. Goi request qua gateway `http://localhost:8000/...`.
  2. Thu goi truc tiep service noi bo:
     - `http://localhost:8003/health`
     - `http://localhost:8004/health`
  3. Dieu kien pass:
     - internal service khong truy cap truc tiep tu host.
  4. Ket qua hien tai:
     - direct access van duoc vi ports dang publish.
  Cach cai thien:
  1. chi expose `api-gateway`,
  2. bo publish port cua internal services,
  3. neu can, them network policy / reverse proxy.
  Cach test: thu goi truc tiep service tu host phai bi chan.
- `TC99` Data encryption in transit
  Trang thai: `CHUA PASS`.
  Ly do: local stack dang chay HTTP, chua co TLS termination.
  Cach test chi tiet:
  1. Thu goi endpoint public bang `http://`.
  2. Dieu kien pass:
     - HTTP bi reject/redirect
     - HTTPS moi duoc chap nhan.
  3. Ket qua hien tai:
     - stack local van HTTP-only.
  Cach cai thien:
  1. them reverse proxy HTTPS,
  2. redirect/reject plain HTTP,
  3. neu co service-to-service TLS thi bo sung cert chain.
  Cach test: goi HTTP bi tu choi, goi HTTPS pass.
- `TC70` Auto scaling hoat dong
  Trang thai: `CHUA PASS` trong local compose.
  Ly do: khong co HPA/autoscaler that.
  Cach test chi tiet:
  1. Can K8s/HPA hoac orchestrator co autoscaling.
  2. Dat target CPU/RPS.
  3. Tao tai lien tuc.
  4. Quan sat replica tang.
  Cach cai thien: chuyen sang K8s hoac nen tang co autoscaling.
- `TC87` Data encryption at rest
  Trang thai: `CHUA PASS`.
  Ly do: chua co disk encryption hoac field-level encryption ro rang trong repo.
  Cach test chi tiet:
  1. Dump DB hoac mo volume.
  2. Tim du lieu nhay cam.
  3. Dieu kien pass:
     - du lieu tren dia/field nhay cam da ma hoa.
  4. Ket qua hien tai:
     - chua co bang chung ma hoa that.
  Cach cai thien: ma hoa volume/DB storage va truong nhay cam.
- `TC88` mTLS communication
  Trang thai: `CHUA PASS`.
  Ly do: chua co cert distribution/service mesh mTLS.
  Cach test chi tiet:
  1. Chuan bi cert server/client va trust chain.
  2. Goi request hop le voi cert dung.
  3. Goi request voi cert sai/thieu.
  4. Dieu kien pass:
     - request hop le duoc chap nhan
     - request sai bi tu choi.
  Cach cai thien: Envoy/Istio/Linkerd/Nginx mutual TLS.
- `TC94` Service-to-service authentication
  Trang thai: `CHUA PASS`.
  Ly do: chua co client cert auth giua services.
  Cach test chi tiet:
  1. Request noi bo co cert hop le -> pass.
  2. Request noi bo thieu cert/cert sai -> fail.
  3. Quan sat log/proxy layer.
  Cach cai thien: bat mutual TLS va cert validation tai proxy/mesh layer.

## 5. Ghi chu thuc te khi demo

- Cac case `PASS` nen uu tien demo bang:
  - Postman collection,
  - Node scripts trong `qa-tests/`,
  - Grafana / Jaeger / logs.
- Cac case `READY` co the demo ngay, nhung nen rerun truoc khi chot diem.
- Cac case `MANUAL` khong nen ep thanh Postman thuần; nen demo bang log, SSE, Docker, Grafana, Jaeger.
- Cac case `CHUA PASS` nen trinh bay thang la local stack chua dat, kem huong nang cap cu the.

## 6. Lenh demo nhanh de chay lai

```powershell
node qa-tests/run-pdf-auto-cases.mjs
node qa-tests/payment-pricing.test.mjs
node qa-tests/tc30-pricing-timeout-retry.mjs
node qa-tests/tc35-concurrent-booking.mjs
node qa-tests/tc36-saga-success.mjs
node qa-tests/tc37-saga-failure-compensation.mjs
node qa-tests/tc38-kafka-outbox-consistency.mjs
node qa-tests/tc39-payment-timeout-partial-failure.mjs
node qa-tests/tc47-agent-latency.mjs
node qa-tests/tc48-drift-detection.mjs
node qa-tests/tc49-agent-fallback.mjs
node qa-tests/tc52-agent-rating.mjs
node qa-tests/tc53-agent-balance.mjs
node qa-tests/tc54-agent-tools.mjs
node qa-tests/tc56-agent-retry.mjs
node qa-tests/tc59-agent-concurrency.mjs
node qa-tests/tc61-booking-load.mjs
node qa-tests/tc62-eta-load.mjs
node qa-tests/tc63-pricing-spike.mjs
node qa-tests/tc64-kafka-throughput.mjs
node qa-tests/tc65-db-pool-exhaustion.mjs
node qa-tests/tc66-cache-hit-rate.mjs
node qa-tests/tc67-api-gateway-rate-limit.mjs
node qa-tests/tc68-p95-latency.mjs
node qa-tests/tc69-peak-hour-load.mjs
node qa-tests/tc116-error-alert.mjs
node qa-tests/tc117-latency-alert.mjs
node qa-tests/tc118-ai-monitoring.mjs
```
