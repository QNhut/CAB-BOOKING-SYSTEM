# Non-API Demo Scenarios From `final_PROJECT_grading-factor.pdf`

Nguồn gốc testcase trong file này chỉ dựa trên:
- [final_PROJECT_grading-factor.pdf](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/final_PROJECT_grading-factor.pdf)
- [qa-tests/final_PROJECT_grading-factor.extracted.txt](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/final_PROJECT_grading-factor.extracted.txt)

Mục đích:
- Gom các testcase không thể chứng minh đầy đủ chỉ bằng một HTTP response.
- Mô tả kịch bản demo ngắn gọn cho người chấm.
- Chỉ ra cần nhìn vào đâu: log, SSE, Grafana, Jaeger, Docker, load script, DB state.

## Legend
- `Log-based`: cần xem structured logs.
- `Trace-based`: cần xem Jaeger trace/span.
- `Metrics-based`: cần xem `/metrics`, Prometheus hoặc Grafana.
- `Load-based`: cần script load/concurrency.
- `Fault-injection`: cần cố ý gây lỗi/timeout/down service.
- `Infra/manual`: cần Docker/Compose, deploy state, dashboard hạ tầng.
- `UI/manual`: cần browser hoặc UI để xác nhận hành vi.

## 1. Event, Saga, Kafka, Agent Decision

### `TC25` Kafka event `ride_requested` publish
- Loại demo: `Log-based`
- Vì sao không đủ qua API:
  API tạo booking chỉ chứng minh request thành công, không chứng minh event đã publish.
- Kịch bản demo:
  1. Chạy request tạo booking hợp lệ qua gateway.
  2. Mở log `ride-service` và `notification-service`.
  3. Chỉ ra log có event `ride_requested` hoặc log xử lý downstream tương ứng.
  4. Kết luận event đã được publish và được service khác tiêu thụ.

### `TC36` Saga success flow
- Loại demo: `Log-based` + `Postman hybrid`
- Vì sao không đủ qua API:
  Một response không thể hiện đủ toàn bộ chuỗi booking -> ride -> accept -> matched.
- Kịch bản demo:
  1. Tạo booking với user token.
  2. Poll current ride của driver.
  3. Driver accept ride.
  4. Query booking/ride state sau cùng.
  5. Mở log `ride-service` để chỉ ra các bước chuyển trạng thái.

### `TC37` Saga failure + compensation
- Loại demo: `Log-based` + `Fault-injection`
- Vì sao không đủ qua API:
  Cần chứng minh side effect thất bại đã kéo theo compensation.
- Kịch bản demo:
  1. Tạo booking/payment flow theo case fail.
  2. Trigger `PAYMENT_FAILED`.
  3. Query booking lại để thấy trạng thái `FAILED` hoặc `CANCELLED`.
  4. Mở log `booking-consumer` hoặc `payment-service` để chỉ ra compensation event đã chạy.

### `TC38` Kafka event consistency/outbox
- Loại demo: `Log-based` + `Infra/manual`
- Vì sao không đủ qua API:
  Cần chứng minh DB state và event publish nhất quán.
- Kịch bản demo:
  1. Tạo booking hợp lệ.
  2. Mở log `booking-service` và `outbox-worker`.
  3. Chỉ ra bản ghi booking commit xong rồi outbox mới publish event.
  4. Nếu cần, đối chiếu thêm DB state hoặc log consumer downstream.

### `TC44` Recommendation top-3 drivers
- Loại demo: `Postman/API`
- Kịch bản demo:
  1. Gọi `TC44 - Recommendation Returns Top-3 Drivers`.
  2. Chỉ ra response có `top_3` với đúng 3 driver.
  3. Xác nhận `top_3` đã được sort theo `total_score` giảm dần.

### `TC51` Agent chọn driver gần nhất
- Loại demo: `Log-based`
- Vì sao không đủ qua API:
  Cần thấy reasoning hoặc danh sách candidate, không chỉ final result.
- Kịch bản demo:
  1. Cho nhiều driver online với khoảng cách khác nhau.
  2. Trigger booking/agent selection.
  3. Mở log `agent-service`.
  4. Chỉ ra driver gần nhất có score tốt nhất và được chọn.

### `TC52` Agent cân nhắc rating
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Tạo 2 driver với khoảng cách gần nhau nhưng rating khác nhau.
  2. Trigger selection qua agent.
  3. Mở log `agent-service`.
  4. Chỉ ra rating được đưa vào scoring.

### `TC53` Agent cân bằng ETA vs price
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Gọi `agent/context` hoặc booking flow với traffic/demand khác nhau.
  2. Mở log `agent-service`.
  3. Chỉ ra agent đã gọi ETA + Pricing và dùng cả hai để ra quyết định.

### `TC54` Agent gọi đúng tool
- Loại demo: `Trace-based`
- Kịch bản demo:
  1. Gọi `POST /agent/context` hoặc `POST /agent/booking-flow-trace`.
  2. Mở Jaeger.
  3. Tìm trace tương ứng.
  4. Chỉ ra các span tới `driver-service`, `eta-service`, `pricing-service`, `payment-service`.

### `TC55` Agent xử lý thiếu context
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Gọi `agent/context` với payload thiếu một phần optional context.
  2. Xem response vẫn có fallback.
  3. Mở log `agent-service` để chỉ ra nhánh fallback được dùng.

### `TC56` Agent retry khi service lỗi
- Loại demo: `Fault-injection` + `Log-based`
- Kịch bản demo:
  1. Dùng hook test timeout/fail-once với pricing hoặc tạm làm service con chậm.
  2. Gọi `agent/context`.
  3. Response vẫn thành công hoặc degrade controlled.
  4. Log `agent-service` phải cho thấy retry.

### `TC58` Agent log decision đầy đủ
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Trigger một lần select driver.
  2. Mở log `agent-service`.
  3. Chỉ ra các field: `trace_id`, input ride, candidates, tool results, selected driver.

### `TC60` Agent fallback rule-based khi AI fail
- Loại demo: `Fault-injection` + `Log-based`
- Kịch bản demo:
  1. Gây lỗi tool hoặc AI path.
  2. Gọi selection.
  3. Log phải thể hiện fallback rule-based được kích hoạt.
  4. Kết quả cuối vẫn có decision hợp lệ hoặc controlled failure.

## 2. Fault Injection, Consistency, Retry, Resilience

### `TC32` Rollback khi lỗi giữa chừng
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Gọi `POST /bookings` với header `X-Test-Simulate-Failure: after_booking_insert`.
  2. Nhận `500`.
  3. Query lại booking ID đã ép trước bằng `X-Test-Booking-Id`.
  4. Nhận `404`, chứng minh transaction rollback.

### `TC39` Partial failure network issue
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Tạm dừng một downstream service hoặc làm request timeout.
  2. Gọi flow booking/agent.
  3. Quan sát response controlled, không crash.
  4. Dùng log để chỉ ra retry/fallback/degrade path.

### `TC40` Data integrity ACID
- Loại demo: `Fault-injection` + `Infra/manual`
- Kịch bản demo:
  1. Trigger lỗi sau insert như `TC32`.
  2. Query booking theo ID.
  3. Xác nhận không có record nửa chừng.
  4. Nếu cần, mở DB shell để chứng minh không còn row rác.

### `TC47` AI latency < 200ms
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Chạy script benchmark nhiều lần vào `agent/context` hoặc `eta/predict`.
  2. Thu latency distribution.
  3. Tính p95/p99 hoặc average theo testcase.
  4. Chụp kết quả terminal/report.

### `TC49` Model fallback khi lỗi
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Làm OSRM hoặc route path lỗi.
  2. Gọi ETA/predict.
  3. Response vẫn trả fallback `routeSource` kiểu `haversine`.
  4. Log chỉ ra fallback path.

### `TC59` Agent xử lý nhiều request song song
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Chạy script concurrency vào `agent/context`.
  2. Thu số request thành công/thất bại.
  3. Chỉ ra service không crash và decision vẫn trả được.

### `TC71` Driver service down -> fallback
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Stop `driver-service`.
  2. Gọi booking/agent context.
  3. Quan sát hệ thống degrade controlled.
  4. Mở log `agent-service` hoặc `ride-service` để chỉ ra driver tool lỗi nhưng không kéo sập toàn flow.

### `TC72` Pricing timeout -> retry
- Loại demo: `Fault-injection` + `Script`
- Kịch bản demo:
  1. Chạy [tc30-pricing-timeout-retry.mjs](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/tc30-pricing-timeout-retry.mjs).
  2. Chỉ ra response vẫn `200`.
  3. Log/response cho thấy pricing có retry hoặc fallback thành công.

### `TC75` Circuit breaker open
- Loại demo: `Fault-injection` + `Log-based`
- Kịch bản demo:
  1. Gây lỗi lặp lại ở downstream service.
  2. Gọi flow nhiều lần.
  3. Xem endpoint circuit breaker hoặc logs.
  4. Chỉ ra trạng thái breaker chuyển `open`.

### `TC76` Partial system failure handling
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Làm một service con down.
  2. Gọi flow chính.
  3. Quan sát response controlled, không treo vô hạn.
  4. Log thể hiện graceful handling.

### `TC77` Retry exponential backoff
- Loại demo: `Log-based` + `Script`
- Kịch bản demo:
  1. Trigger lỗi retryable.
  2. Ghi timestamp các lần retry trong log.
  3. Chỉ ra khoảng cách retry tăng dần.

### `TC80` Graceful degradation
- Loại demo: `Fault-injection`
- Kịch bản demo:
  1. Tắt tạm một dependency không critical.
  2. Gọi flow chính.
  3. Hệ thống vẫn trả kết quả degrade hợp lý thay vì crash.
  4. Dùng log để chỉ ra fallback path.

## 3. Security, Compliance, Audit

### `TC82` XSS input test
- Loại demo: `UI/manual`
- Kịch bản demo:
  1. Gửi payload chứa script vào field text phù hợp.
  2. Mở UI hiển thị lại dữ liệu đó.
  3. Chỉ ra script không được execute, chỉ hiển thị như text hoặc bị sanitize.

### `TC87` Data encryption at rest
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Nêu rõ repo hiện không có volume encryption hay field-level encryption rõ ràng.
  2. Nếu bị hỏi sâu, chỉ ra đây là case chưa implement đầy đủ trong local stack.
  3. Muốn pass thật cần disk encryption hoặc mã hóa trường nhạy cảm trước khi lưu DB.

### `TC88` mTLS communication
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Mở config compose hiện tại và nêu rõ chưa có cert/service mesh.
  2. Chỉ ra local stack chưa có mutual TLS handshake.
  3. Muốn pass thật cần cert server/client và mutual verification ở proxy/mesh.

### `TC90` Sensitive data masking
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Trigger payment thành công/thất bại với card test.
  2. Mở log `payment-service`.
  3. Chỉ ra card được mask dạng `****1234`.
  4. Chỉ ra response không lộ số thẻ đầy đủ.

### `TC94` Service-to-service authentication mTLS
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Nêu rõ repo hiện chưa có client cert validation giữa service.
  2. Không nên fake pass bằng app-level header vì rubric đang nói mTLS/service auth.
  3. Muốn pass thật cần proxy/mesh từ chối request thiếu cert hợp lệ.

### `TC97` API Gateway kiểm tra tất cả request
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Gọi API qua gateway.
  2. So với việc cố gọi trực tiếp service port nội bộ từ ngoài.
  3. Với compose hiện tại, nhiều service vẫn publish port host nên case này chưa pass hoàn toàn.
  4. Muốn pass thật cần chỉ expose gateway, bỏ publish port của internal service.

### `TC99` Data encryption in transit
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Nêu rõ local compose hiện đang dùng HTTP, chưa có HTTPS termination.
  2. Nếu chấm theo production-grade security, đây là case chưa pass.
  3. Muốn pass thật cần TLS reverse proxy và reject plain HTTP.

### `TC100` Audit logging
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Login user.
  2. Gọi một API protected như tạo booking.
  3. Mở log `auth-service` và `booking-service`.
  4. Chỉ ra có `timestamp`, `service_name`, `request_id`, `trace_id`, actor/action, status.

## 4. Performance, Load, Stress

### `TC35` Concurrent booking/race condition
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Bắn 2 request booking song song với cùng idempotency key.
  2. Chỉ ra chỉ một booking logic được chấp nhận hoặc replay đúng.
  3. Nếu cần, đối chiếu DB/log.

### `TC61` 1000 req/s booking
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Dùng k6/Artillery/Newman parallel bắn vào booking API.
  2. Thu success rate, error rate, latency.
  3. Mở Grafana/Prometheus nếu cần.

### `TC62` ETA service under load
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Bắn tải vào `POST /eta/predict`.
  2. Thu throughput và latency.

### `TC63` Pricing service under spike
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Bắn spike vào `POST /pricing/estimate`.
  2. Chỉ ra service vẫn trả controlled response.

### `TC64` Kafka throughput test
- Loại demo: `Load-based` + `Metrics-based`
- Kịch bản demo:
  1. Tạo lượng lớn booking/event.
  2. Xem log producer/consumer và Kafka metrics.
  3. Chỉ ra consumer vẫn theo kịp hoặc backlog chấp nhận được.

### `TC65` DB connection pool exhaustion
- Loại demo: `Load-based` + `Metrics-based`
- Kịch bản demo:
  1. Bắn tải cao vào API dùng DB.
  2. Xem logs, DB metrics, error rate.
  3. Chỉ ra system reject controlled thay vì crash.

### `TC66` Redis cache hit rate > 90%
- Loại demo: `Metrics-based`
- Kịch bản demo:
  1. Gọi lặp API/cache path nhiều lần.
  2. Mở Redis metrics hoặc application cache stats.
  3. Chỉ ra hit rate theo tiêu chí.

### `TC68` P95 latency < 300ms
- Loại demo: `Load-based` + `Metrics-based`
- Kịch bản demo:
  1. Chạy `node qa-tests/tc68-p95-latency.mjs`.
  2. Script in `p95_ms` và fail nếu vượt ngưỡng.
  3. Mở Grafana panel p95/p99 nếu cần đối chiếu.

### `TC69` Load test giờ cao điểm
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Chạy `node qa-tests/tc69-peak-hour-load.mjs`.
  2. Payload đã giả lập giờ cao điểm bằng `hour=18`, `traffic_level=1.0`, `demand_index=2.0`, `supply_index=0.8`.
  3. Thu `achieved_rps`, `p95_ms`, `p99_ms`, `statuses`.

### `TC85` Rate limit attack
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Chạy [rate-limit-burst.mjs](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/rate-limit-burst.mjs).
  2. Chỉ ra một phần request `200`, phần vượt ngưỡng trả `429`.
  3. Kết luận limiter chống abuse hoạt động.

### `TC98` Rate limiting chống abuse
- Loại demo: `Load-based`
- Kịch bản demo:
  1. Chạy [rate-limit-burst.mjs](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/rate-limit-burst.mjs).
  2. Dùng target `GET /health` hoặc endpoint auth.
  3. Chỉ ra request vượt `100 req/s` bắt đầu nhận `429 Too Many Requests`.

## 5. Deployment, Infra, Connectivity

### `TC70` Auto scaling hoạt động
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Nêu rõ repo local đang chạy Docker Compose, không có HPA/autoscaler thật.
  2. Vì vậy không nên tuyên bố pass case này trong local environment.
  3. Muốn pass thật cần K8s hoặc orchestrator có autoscaling và demo replica tăng khi CPU/RPS cao.

### `TC73` Kafka down -> buffer event
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Tạm dừng Kafka.
  2. Trigger event-producing flow.
  3. Chỉ ra app buffer/retry/outbox thay vì mất sự kiện.

### `TC74` DB failover
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Gây lỗi DB primary hoặc thay endpoint DB.
  2. Chỉ ra failover/fallback nếu có.

### `TC78` Service mesh routing fail
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Trình bày config routing/service mesh.
  2. Gây route sai hoặc test route.
  3. Chỉ ra hệ thống phát hiện và xử lý thế nào.

### `TC79` Network partition test
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Chặn network giữa hai service.
  2. Gọi flow phụ thuộc giữa chúng.
  3. Quan sát timeout, retry, degrade behavior.

### `TC101` Deploy service thành công
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. `docker compose up -d` hoặc rollout môi trường.
  2. Xem container `Up` và health `200`.
  3. Gọi smoke API.

### `TC103` Environment variables đúng
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Mở `.env` và `docker-compose.dev.yml`.
  2. Chỉ ra service đọc biến đúng.
  3. Mở log startup nếu cần.

### `TC104` Service connect database
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Mở health endpoint.
  2. Trigger một API có truy cập DB.
  3. Chỉ ra không lỗi connection DB.

### `TC105` Service connect Kafka
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Trigger flow có publish event.
  2. Xem logs producer/consumer.
  3. Chỉ ra connect Kafka thành công.

### `TC106` Rolling update zero downtime
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Giữ một cửa sổ liên tục gọi health hoặc API smoke.
  2. Recreate từng service theo chiến lược cuốn chiếu.
  3. Chỉ ra không có hoặc rất ít request lỗi trong lúc update.

### `TC107` Auto scaling HPA
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Trình bày config scale.
  2. Tạo tải.
  3. Chứng minh replica tăng.

### `TC108` Service mesh routing
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Trình bày route/service mesh config.
  2. Chứng minh request được route đúng.

### `TC109` Config sai -> fail fast
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Khởi động service với ENV sai.
  2. Chỉ ra service fail ngay từ startup hoặc health fail.
  3. Log phải rõ ràng, không im lặng chạy sai.

### `TC110` Rollback deployment
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Cập nhật service lên version/config lỗi.
  2. Health/API smoke fail.
  3. Rollback về image/config cũ.
  4. Health và smoke API pass lại.

## 6. Observability, Monitoring, Dashboard

### `TC111` Logging đầy đủ request
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Gọi `POST /bookings`.
  2. Mở log `booking-service`.
  3. Chỉ ra log có `request_id`, `trace_id`, request summary, response summary, status, duration.

### `TC112` Structured logging format
- Loại demo: `Log-based`
- Kịch bản demo:
  1. Trigger một vài API bất kỳ.
  2. Mở logs của service.
  3. Chỉ ra mỗi dòng là JSON parse được, có `timestamp`, `service_name`, `level`.

### `TC114` Dashboard hiển thị đúng
- Loại demo: `Metrics-based`
- Kịch bản demo:
  1. Tạo traffic vào hệ thống.
  2. Mở Grafana dashboard.
  3. Chỉ ra request rate, p95, p99 có dữ liệu.
  4. Nếu cần, đối chiếu query Prometheus.

### `TC115` Distributed tracing hoạt động
- Loại demo: `Trace-based`
- Kịch bản demo:
  1. Gọi `POST /agent/booking-flow-trace`.
  2. Lấy `trace_id` từ response.
  3. Mở Jaeger.
  4. Tìm trace đó và chỉ ra span xuyên `api-gateway -> agent-service -> eta/pricing/driver/payment`.

### `TC116` Alert khi error rate cao
- Loại demo: `Metrics-based` + `Infra/manual`
- Kịch bản demo:
  1. Cố ý tạo nhiều request lỗi.
  2. Mở Grafana/Prometheus alert rule.
  3. Chỉ ra alert điều kiện đã bị kích hoạt.

### `TC117` Alert khi latency cao
- Loại demo: `Metrics-based` + `Infra/manual`
- Kịch bản demo:
  1. Làm service chậm hoặc bắn tải cao.
  2. Quan sát p95/p99 tăng.
  3. Chỉ ra alert latency bật lên.

### `TC118` AI service monitoring
- Loại demo: `Metrics-based` + `Log-based`
- Kịch bản demo:
  1. Gọi `eta`, `pricing`, `agent`.
  2. Mở metrics, drift endpoint, logs.
  3. Chỉ ra model/service health và monitoring data.

### `TC119` Kafka monitoring
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Trigger event flow.
  2. Mở Kafka logs/metrics/dashboard nếu có.
  3. Chỉ ra topic traffic, consumer activity hoặc lag.

### `TC120` Resource monitoring CPU/Memory
- Loại demo: `Infra/manual`
- Kịch bản demo:
  1. Tạo tải.
  2. Mở Docker stats, Prometheus node/container metrics hoặc dashboard tương ứng.
  3. Chỉ ra CPU/Memory được collect và hiển thị.

## Gợi ý demo nhanh cho người chấm
- Nhóm event/saga: `TC25`, `TC36`, `TC37`, `TC38`
- Nhóm resilience: `TC32`, `TC72`, `TC75`, `TC80`
- Nhóm security/compliance: `TC90`, `TC100`
- Nhóm performance: `TC85`, `TC98`
- Nhóm observability: `TC111`, `TC112`, `TC114`, `TC115`
- Nhóm deployment/infra: `TC101`, `TC106`, `TC110`

## Lưu ý
- Một số testcase trong PDF mô tả năng lực kiến trúc lý tưởng hơn public API hiện có. Với các case đó, demo đúng cách là dùng logs, metrics, tracing, SSE, load script hoặc thao tác hạ tầng.
- Nếu cần, có thể tách tiếp file này thành:
  - `manual-demo-checklist.md`
  - `load-test-checklist.md`
  - `observability-demo-checklist.md`
