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

## 1. PASS da verify runtime

- `TC01` Register user thanh cong
  Cach test: Postman `TC01 - Register USER Successfully` hoac `node qa-tests/run-pdf-auto-cases.mjs`.
- `TC02` Login tra JWT hop le
  Cach test: Postman `TC02 - Login Returns Valid JWT`.
- `TC03` Tao booking hop le
  Cach test: Postman `TC03 - Create Booking With Valid Input`.
- `TC05` Driver online
  Cach test: Postman `TC05 - Driver Goes Online`.
- `TC06` Booking co status ban dau dung
  Cach test: Postman `TC06 - Booking Initial Status Is REQUESTED`.
- `TC07` ETA > 0
  Cach test: Postman `TC07 - ETA API Returns > 0`.
- `TC08` Pricing hop le
  Cach test: Postman `TC08 - Pricing API Returns Valid Price`.
- `TC10` Logout invalidate token
  Cach test: Postman `TC10 - Logout` va `TC10 - Refresh With Revoked Token -> 401`.
- `TC11` Booking thieu pickup
  Cach test: Postman `TC11 - Booking Missing Pickup -> 400`.
- `TC12` Sai format lat/lng
  Cach test: Postman `TC12 - Invalid Lat/Lng Format -> 422`.
- `TC14` Payment method invalid
  Cach test: Postman `TC14 - Invalid Payment Method On Booking -> 400` va `TC14b`.
- `TC15` ETA voi distance = 0
  Cach test: Postman `TC15 - ETA With Distance 0`.
- `TC16` Pricing voi demand_index = 0
  Cach test: Postman `TC16 - Pricing With demand_index = 0`.
- `TC17` Fraud API thieu field
  Cach test: Postman `TC17 - Fraud API Missing Field -> 400`.
- `TC18` Unauthorized request
  Cach test: Postman `TC18 - Unauthorized Request -> 401`.
- `TC19` Duplicate booking / idempotency
  Cach test: Postman `TC19 - Duplicate Booking Request Step 1` va `Step 2 Replay`.
- `TC20` Payload qua lon
  Cach test: Postman `TC20 - Payload Too Large -> 413`.
- `TC29` API Gateway route dung service
  Cach test: toan bo collection chay qua `http://localhost:8000`.
- `TC30` Retry khi Pricing timeout
  Cach test: `node qa-tests/tc30-pricing-timeout-retry.mjs`.
- `TC32` Rollback khi loi giua chung
  Cach test: fault injection qua booking header test hook, script/Postman verify booking `404` sau rollback.
- `TC33` Payment that bai -> rollback booking
  Cach test: `node qa-tests/tc37-saga-failure-compensation.mjs` hoac Postman folder `TC33`.
- `TC34` Idempotent transaction
  Cach test: booking/payment cung `X-Idempotency-Key`, khong tao giao dich moi.
- `TC35` Concurrent booking
  Cach test: `node qa-tests/tc35-concurrent-booking.mjs`.
- `TC36` Saga transaction success
  Cach test: `node qa-tests/tc36-saga-success.mjs`.
- `TC37` Saga failure + compensation
  Cach test: `node qa-tests/tc37-saga-failure-compensation.mjs`, ket qua booking `CANCELLED`.
- `TC38` Kafka event consistency / outbox
  Cach test: `node qa-tests/tc38-kafka-outbox-consistency.mjs`.
- `TC39` Partial failure network issue
  Cach test: `node qa-tests/tc39-payment-timeout-partial-failure.mjs`.
- `TC40` Data integrity ACID
  Cach test: fault injection sau insert, verify rollback hoan toan.
- `TC41` ETA output trong range hop ly
  Cach test: `TC07` va script agent/eta; verify `eta >= 0`.
- `TC42` Surge > 1 khi demand cao
  Cach test: Postman `TC42 - Pricing Surge High Demand -> > 1`.
- `TC43` Fraud score > threshold -> flagged
  Cach test: Postman `TC43 - Fraud Score Above Threshold -> flagged` hoac request truc tiep `/fraud/check`.
- `TC44` Recommendation tra top-3 drivers
  Cach test: Postman `TC44 - Recommendation Returns Top-3 Drivers`.
- `TC45` Forecast schema dung
  Cach test: Postman `TC45 - Forecast Returns Correct Format`.
- `TC46` Model version tra dung
  Cach test: Postman `TC46 - ETA Model Version Is Returned`.
- `TC47` AI latency < 200ms
  Cach test: `node qa-tests/tc47-agent-latency.mjs` do truc tiep `agent-service`.
- `TC48` Drift detection trigger
  Cach test: `node qa-tests/tc48-drift-detection.mjs`.
- `TC49` Model fallback khi loi
  Cach test: `node qa-tests/tc49-agent-fallback.mjs`.
- `TC51` Agent chon driver gan nhat
  Cach test: Postman `TC51 - Agent Chooses Nearest Driver` hoac `POST /agent/select-driver` voi `available_drivers` inline; da verify qua `force_rule_based`.
- `TC52` Agent chon driver rating cao hon khi khoang cach gan nhau
  Cach test: `node qa-tests/tc52-agent-rating.mjs`.
- `TC53` Agent can bang ETA vs price
  Cach test: `node qa-tests/tc53-agent-balance.mjs`.
- `TC54` Agent goi dung tool
  Cach test: `node qa-tests/tc54-agent-tools.mjs`.
- `TC55` Agent xu ly context thieu du lieu
  Cach test: `node qa-tests/tc55-agent-missing-context.mjs`.
- `TC56` Agent retry khi service loi
  Cach test: `node qa-tests/tc56-agent-retry.mjs`.
- `TC57` Agent khong chon driver offline
  Cach test: Postman hybrid `TC13` hoac script agent voi driver `OFFLINE`.
- `TC58` Agent log decision day du
  Cach test: agent decision log va `GET /agent/decisions/:requestId`.
- `TC59` Agent xu ly nhieu request song song
  Cach test: `node qa-tests/tc59-agent-concurrency.mjs`.
- `TC60` Agent fallback rule-based khi AI fail
  Cach test: `node qa-tests/tc49-agent-fallback.mjs` hoac `TC60` folder.
- `TC61` Booking under load
  Cach test: `node qa-tests/tc61-booking-load.mjs`.
- `TC62` ETA service under load
  Cach test: `node qa-tests/tc62-eta-load.mjs`.
- `TC63` Pricing service under spike
  Cach test: `node qa-tests/tc63-pricing-spike.mjs`.
- `TC64` Kafka throughput test
  Cach test: `node qa-tests/tc64-kafka-throughput.mjs`.
- `TC65` DB connection pool exhaustion
  Cach test: `node qa-tests/tc65-db-pool-exhaustion.mjs`.
- `TC66` Redis cache hit rate > 90%
  Cach test: `node qa-tests/tc66-cache-hit-rate.mjs`.
- `TC67` API Gateway rate limit
  Cach test: `node qa-tests/tc67-api-gateway-rate-limit.mjs`.
- `TC69` Load test gio cao diem
  Cach test: `node qa-tests/tc69-peak-hour-load.mjs`.
- `TC71` Driver service down -> fallback
  Cach test: `node qa-tests/tc71-driver-cache-fallback.mjs`.
- `TC72` Pricing service timeout -> retry
  Cach test: `node qa-tests/tc30-pricing-timeout-retry.mjs`.
- `TC75` Circuit breaker open
  Cach test: `node qa-tests/tc75-circuit-breaker.mjs`.
- `TC76` Partial system failure handling
  Cach test: `node qa-tests/tc39-payment-timeout-partial-failure.mjs` va degraded flow.
- `TC77` Retry exponential backoff
  Cach test: `node qa-tests/tc77-retry-backoff.mjs`.
- `TC80` Graceful degradation
  Cach test: `node qa-tests/tc80-graceful-degradation.mjs`.
- `TC81` SQL injection attempt
  Cach test: payload `' OR 1=1 --` vao auth API, verify `400/401`.
- `TC82` XSS input test
  Cach test: payload `<script>alert(1)</script>` vao booking/auth text field, verify reject/sanitize.
- `TC83` JWT tampering
  Cach test: Postman `TC83/92 - Tampered JWT -> 401`.
- `TC84` Unauthorized / RBAC forbidden
  Cach test: Postman `TC84/89/95 - RBAC Forbidden`.
- `TC85` Rate limit attack
  Cach test: `node qa-tests/rate-limit-burst.mjs`.
- `TC86` Replay attack / idempotency
  Cach test: lap lai request cung `X-Idempotency-Key`.
- `TC90` Sensitive data masking
  Cach test: payment response va logs chi hien `****1234`, khong lo card/token day du.
- `TC91` Request khong co token
  Cach test: Postman `TC91 - Request Without Token`.
- `TC93` Token het han
  Cach test: Postman `TC93 - Expired Token Is Rejected`.
- `TC96` Driver khong truy cap user data
  Cach test: Postman `TC96 - Driver Cannot Access User Data`.
- `TC98` Rate limiting chong abuse
  Cach test: `node qa-tests/rate-limit-burst.mjs` hoac `tc67`.
- `TC102` Health check endpoint
  Cach test: `GET /health`, Postman `TC102/113 - Health And Metrics`.
- `TC111` Logging day du request
  Cach test: tao booking hop le, xem log JSON co `request_id`, `trace_id`, request/response.
- `TC112` Structured logging format
  Cach test: trigger API bat ky, verify log JSON co `timestamp`, `service_name`, `level`.
- `TC113` Metrics duoc expose
  Cach test: `GET /metrics`, Prometheus scrape thanh cong.
- `TC114` Dashboard hien thi dung
  Cach test: Grafana dashboard `Cab Booking System Dashboard`.
- `TC115` Distributed tracing hoat dong
  Cach test: Jaeger + `POST /agent/booking-flow-trace`.
- `TC116` Alert khi error rate cao
  Cach test: `node qa-tests/tc116-error-alert.mjs`.
- `TC117` Alert khi latency cao
  Cach test: `node qa-tests/tc117-latency-alert.mjs`.
- `TC118` AI service monitoring
  Cach test: `node qa-tests/tc118-ai-monitoring.mjs`.

## 2. READY da co testcase/collection, nhung chua verify lai trong dot tong hop nay

- `TC04` Lay booking hien tai cua user
  Cach test: Postman `TC04 - Get Current User Booking View`.
- `TC09` Notification gui thanh cong
  Cach test: mo SSE `/notifications/stream`, sau do chay booking/ride/payment flow.
- `TC13` Driver offline khong nhan booking
  Cach test: Postman `TC13` + log `ride-service`.
- `TC21` Booking goi ETA service
  Cach test: Postman support request va giai thich mapping hien tai.
- `TC22` Booking goi Pricing service
  Cach test: Postman support request va giai thich `pricingSnapshot`.
- `TC23` AI Agent chon driver tu Driver Service
  Cach test: booking flow + poll ride/driver.
- `TC24` Booking -> Payment -> Notification flow
  Cach test: Postman hybrid `TC24`, mo SSE rieng neu demo live.
- `TC25` Kafka event `ride_requested`
  Cach test: tao booking, xem log `ride-service` / `notification-service`.
- `TC26` Driver nhan notification
  Cach test: mo SSE driver, tao booking khi driver online.
- `TC27` Booking update `ACCEPTED`
  Cach test: Postman `TC27 - Poll Driver Current Ride`, `Accept Offered Ride`, `Verify Booking Became MATCHED`.
- `TC28` MCP context fetch thanh cong
  Cach test: Postman `TC28 - MCP Context Fetch Success`.
- `TC31` Transaction tao booking thanh cong
  Cach test: create booking roi `GET /bookings/{id}`.
- `TC50` Input bat thuong model khong crash
  Cach test: Postman `TC50 - Outlier Input Does Not Crash ETA`.
- `TC89` RBAC enforcement
  Cach test: Postman `TC84/89/95 - RBAC Forbidden`.
- `TC92` Token khong hop le
  Cach test: Postman `TC83/92 - Tampered JWT -> 401`.
- `TC95` User khong co quyen
  Cach test: Postman `TC84/89/95 - RBAC Forbidden`.
- `TC100` Audit logging
  Cach test: login + protected API, xem logs actor/action/status.
- `TC101` Deploy service thanh cong
  Cach test: `docker compose up -d`, kiem tra `health`.
- `TC103` Environment variables dung
  Cach test: doi chieu `.env` va `docker-compose.dev.yml`, xem startup log.
- `TC104` Service connect database
  Cach test: health + API truy DB.
- `TC105` Service connect Kafka
  Cach test: trigger flow co event, xem producer/consumer log.
- `TC109` Config sai -> fail fast
  Cach test: start service voi ENV sai, verify startup fail / health fail.
- `TC119` Kafka monitoring
  Cach test: Kafka UI + logs + metrics.
- `TC120` Resource monitoring CPU/Memory
  Cach test: Grafana/Prometheus/docker stats.

## 3. MANUAL / INFRA testcases chua phu hop de chot bang API thuan

- `TC51` Agent chon driver gan nhat
  Kich ban test: goi `POST /agent/select-driver` voi danh sach driver inline, xem `selected_driver` va `top_3`.
- `TC52` Agent can nhac rating
  Kich ban test: 2 driver khoang cach gan nhau, rating khac nhau, so sanh ket qua.
- `TC53` Agent can bang ETA vs price
  Kich ban test: inline drivers co `eta_minutes` va `price`, verify scoring.
- `TC54` Agent goi dung tool
  Kich ban test: log/trace `tools_called`, Jaeger spans.
- `TC55` Agent xu ly context thieu du lieu
  Kich ban test: bo mot so optional field, verify khong crash va co fallback.
- `TC56` Agent retry khi service loi
  Kich ban test: fail-once hook pricing/eta + logs retry.
- `TC58` Agent log decision day du
  Kich ban test: doc `GET /agent/decisions/:requestId` hoac log structured.
- `TC70` Auto scaling hoat dong
  Kich ban test: can K8s/HPA hoac orchestrator co autoscale that, tao tai va quan sat replica tang.
- `TC73` Kafka down -> buffer event
  Kich ban test: dung Kafka hoac outbox worker, tao booking, xem `outbox_events`.
- `TC74` DB failover
  Kich ban test: restart/doi endpoint DB, verify reconnect hoac failover.
- `TC78` Service mesh routing fail
  Kich ban test: can mesh/proxy route rule that; gay route sai va quan sat fallback/503.
- `TC79` Network partition test
  Kich ban test: chan network giua 2 service, quan sat timeout/retry/degrade.
- `TC87` Data encryption at rest
  Kich ban test: truy cap DB volume/storage, chung minh field/volume duoc ma hoa.
- `TC88` mTLS communication
  Kich ban test: cert server/client, mutual verification, request co va khong co cert.
- `TC94` Service-to-service authentication
  Kich ban test: request noi bo co cert hop le va cert sai/thieu.
- `TC106` Rolling update
  Kich ban test: health/smoke lien tuc khi recreate/roll update.
- `TC107` Auto scaling HPA
  Kich ban test: HPA config + tai + replica tang.
- `TC108` Service mesh routing
  Kich ban test: trinh bay route config va request di dung duong.
- `TC110` Rollback deployment
  Kich ban test: deploy version loi, rollback, health pass lai.

## 4. CHUA PASS hoac chua dat theo local stack hien tai

- `TC68` P95 latency < 300ms
  Trang thai: `CHUA PASS`.
  Ket qua gan nhat: `node qa-tests/tc68-p95-latency.mjs http://127.0.0.1:8009 200 40 300` cho `p95_ms=336`.
  Cach cai thien:
  1. toi uu `eta-service` cho duong cache nong,
  2. giam overhead JSON/Redis/trace,
  3. neu can, tach benchmark internal va gateway benchmark.
  Cach test lai: chay lai `node qa-tests/tc68-p95-latency.mjs`.
- `TC97` API Gateway kiem tra tat ca request
  Trang thai: `CHUA PASS`.
  Ly do: nhieu internal service van publish port ra host trong `docker-compose.dev.yml`.
  Cach cai thien:
  1. chi expose `api-gateway`,
  2. bo publish port cua internal services,
  3. neu can, them network policy / reverse proxy.
  Cach test: thu goi truc tiep service tu host phai bi chan.
- `TC99` Data encryption in transit
  Trang thai: `CHUA PASS`.
  Ly do: local stack dang chay HTTP, chua co TLS termination.
  Cach cai thien:
  1. them reverse proxy HTTPS,
  2. redirect/reject plain HTTP,
  3. neu co service-to-service TLS thi bo sung cert chain.
  Cach test: goi HTTP bi tu choi, goi HTTPS pass.
- `TC70` Auto scaling hoat dong
  Trang thai: `CHUA PASS` trong local compose.
  Ly do: khong co HPA/autoscaler that.
  Cach cai thien: chuyen sang K8s hoac nen tang co autoscaling.
- `TC87` Data encryption at rest
  Trang thai: `CHUA PASS`.
  Ly do: chua co disk encryption hoac field-level encryption ro rang trong repo.
  Cach cai thien: ma hoa volume/DB storage va truong nhay cam.
- `TC88` mTLS communication
  Trang thai: `CHUA PASS`.
  Ly do: chua co cert distribution/service mesh mTLS.
  Cach cai thien: Envoy/Istio/Linkerd/Nginx mutual TLS.
- `TC94` Service-to-service authentication
  Trang thai: `CHUA PASS`.
  Ly do: chua co client cert auth giua services.
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
