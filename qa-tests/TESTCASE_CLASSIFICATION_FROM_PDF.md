# Testcase Classification From `final_PROJECT_grading-factor.pdf`

Nguồn duy nhất để phân loại là [final_PROJECT_grading-factor.pdf](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/final_PROJECT_grading-factor.pdf), đã được trích bằng PyMuPDF ra [qa-tests/final_PROJECT_grading-factor.extracted.txt](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/final_PROJECT_grading-factor.extracted.txt).

Collection dùng để demo:
- [qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_collection.json](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_collection.json)
- [qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_environment.json](/c:/Users/Levinh/Desktop/New%20folder/DHHTTT18B-N31-cab-system/qa-tests/postman/Cab-Booking-Grading-From-PDF.postman_environment.json)

## Legend
- `Postman auto`: chạy trực tiếp trong collection, có assert trong tab Tests.
- `Postman hybrid`: chạy request trong collection rồi kiểm tra thêm qua request khác, log, polling hoặc SSE.
- `Script/load`: nên dùng Newman, Node script, k6, Artillery hoặc tool tương đương.
- `Infra/manual`: thiên về deploy, observability, hạ tầng; cần demo môi trường thực tế.

## Level 1-4
- `TC01` Register user thành công — `Postman auto` — chạy `TC01 - Register USER Successfully`.
- `TC02` Login trả JWT hợp lệ — `Postman auto` — chạy `TC02 - Login Returns Valid JWT`.
- `TC03` Tạo booking hợp lệ — `Postman auto` — chạy `TC03 - Create Booking With Valid Input`.
- `TC04` Lấy danh sách/booking của user — `Postman auto` — chạy `TC04 - Get Current User Booking View`.
- `TC05` Driver online — `Postman auto` — chạy `TC05 - Driver Goes Online`.
- `TC06` Booking tạo với status ban đầu — `Postman auto` — chạy `TC06 - Booking Initial Status Is REQUESTED`.
- `TC07` ETA > 0 — `Postman auto` — chạy `TC07 - ETA API Returns > 0`.
- `TC08` Pricing hợp lệ — `Postman auto` — chạy `TC08 - Pricing API Returns Valid Price`.
- `TC09` Notification gửi thành công — `Postman hybrid` — mở SSE `GET /notifications/stream`, sau đó dùng `TC09 - Notification Debug Snapshot` và flow booking/ride để quan sát event.
- `TC10` Logout invalidate token — `Postman auto` — chạy `TC10 - Logout` rồi `TC10 - Refresh With Revoked Token -> 401`.
- `TC11` Booking thiếu pickup — `Postman auto` — chạy `TC11 - Booking Missing Pickup -> 400`.
- `TC12` Sai format lat/lng — `Postman auto` — chạy `TC12 - Invalid Lat/Lng Format -> 422`.
- `TC13` Driver offline không nhận booking — `Postman hybrid` — chạy `TC13 - Driver Goes OFFLINE`, `TC13 - Create Booking When No Driver Online`, rồi `TC13 - Check User Current Ride State` và xem logs `ride-service`.
- `TC14` Payment method invalid — `Postman auto` — chạy `TC14 - Invalid Payment Method On Booking -> 400` hoặc `TC14b - Invalid Payment Method On Payment API -> 400`.
- `TC15` ETA với distance = 0 — `Postman auto` — chạy `TC15 - ETA With Distance 0`.
- `TC16` Pricing với demand_index = 0 — `Postman auto` — chạy `TC16 - Pricing With demand_index = 0`.
- `TC17` Fraud API thiếu field — `Postman auto` — chạy `TC17 - Fraud API Missing Field -> 400`.
- `TC18` Unauthorized request — `Postman auto` — chạy `TC18 - Unauthorized Request -> 401`.
- `TC19` Duplicate booking/idempotency — `Postman auto` — chạy `TC19 - Duplicate Booking Request Step 1` rồi `Step 2 Replay`.
- `TC20` Payload quá lớn — `Postman auto` — chạy `TC20 - Payload Too Large -> 413`.
- `TC21` Booking gọi ETA service — `Postman hybrid` — do code hiện tại không gọi ETA nội bộ khi tạo booking, demo bằng `TC21 - ETA Support Request For Booking Flow` và nêu rõ mapping.
- `TC22` Booking gọi Pricing service — `Postman hybrid` — do booking hiện nhận `pricingSnapshot` từ client, demo bằng `TC22 - Pricing Support Request For Booking Flow` và nêu rõ mapping.
- `TC23` AI Agent chọn driver từ Driver Service — `Postman hybrid` — tạo booking khi driver online, dùng `TC27 - Poll Driver Current Ride` để chứng minh ride offer được hình thành; nếu muốn sâu hơn cần logs `ride-service`.
- `TC24` Booking -> Payment -> Notification flow — `Postman hybrid` — dùng booking/payment requests trong folder `04 Hybrid / Integration Support`, cộng thêm SSE/log để chứng minh notification.
- `TC25` Kafka event `ride_requested` publish — `Postman hybrid` — tạo booking rồi xem `ride-service` và `notification-service` logs. Postman chỉ là bước kích hoạt.
- `TC26` Driver nhận notification — `Postman hybrid` — mở SSE cho driver, tạo booking khi driver online, poll current ride hoặc quan sát event `ride_offer`.
- `TC27` Booking update `ACCEPTED` — `Postman hybrid` — chạy `TC27 - Poll Driver Current Ride`, `TC27 - Accept Offered Ride`, rồi `TC27 - Verify Booking Became MATCHED`.
- `TC28` MCP context fetch thành công — `Manual/unsupported public API` — repo hiện không expose public MCP endpoint phù hợp để assert qua Postman.
- `TC29` API Gateway route đúng service — `Postman auto` — mọi request trong collection đều đi qua `{{baseUrl}} = http://localhost:8000`; chứng minh bằng request gateway và response đúng service.
- `TC30` Retry khi Pricing timeout — `Script/load` — cần giả lập timeout hoặc tắt pricing-service; phù hợp hơn với script + docker logs.
- `TC31` Transaction tạo booking thành công — `Postman hybrid` — tạo booking rồi `GET /bookings/{id}` để chứng minh record tồn tại đầy đủ.
- `TC32` Rollback khi lỗi giữa chừng — `Script/manual fault injection` — cần chèn lỗi sau insert DB, không phù hợp Postman thuần.
- `TC33` Payment thất bại -> rollback booking — `Postman hybrid` — chạy `TC24/33 - Create Booking For Payment Failure Compensation`, `Trigger PAYMENT_FAILED Event`, rồi `Check Booking After Payment Failure`.
- `TC34` Idempotent transaction duplicate request — `Postman auto` — dùng `TC19` cho booking và có thể dùng `X-Idempotency-Key` ở payment API nếu cần demo thêm.

## Level 5-6
- `TC35` Concurrent booking/race condition — `Script/load` — cần 2 request song song cùng key hoặc cùng payload; dùng Newman parallel hoặc Node script.
- `TC36` Saga success flow — `Postman hybrid` — cần booking + ride accept + optional SSE; có thể demo một phần bằng folder `04 Hybrid`.
- `TC37` Saga failure + compensation — `Postman hybrid` — dùng `TC24/33` payment fail compensation.
- `TC38` Kafka event consistency/outbox — `Script/manual` — cần so DB state và event publish/log.
- `TC39` Partial failure network issue — `Script/manual` — cần simulate timeout mạng hoặc stop service.
- `TC40` Data integrity ACID — `Script/manual` — cần fault injection, concurrent requests và DB inspection.
- `TC41` ETA model output trong range — `Postman auto` — `TC07` đã cover.
- `TC42` Pricing surge > 1 khi demand cao — `Postman auto` — chạy `TC42 - Pricing Surge High Demand -> > 1`.
- `TC43` Fraud score > threshold -> flagged — `Postman auto` — chạy `TC43 - Fraud Score Above Threshold -> flagged`.
- `TC44` Recommendation top-3 drivers — `Manual/unsupported public API` — không có endpoint public trả top-3 recommendation rõ ràng.
- `TC45` Forecast đúng format — `Postman auto` — chạy `TC45 - Forecast Returns Correct Format`. Lưu ý schema hiện tại của repo là `zone/hour/demand_index/supply_index/...`, không đúng hệt wording trong PDF.
- `TC46` Model version trả đúng — `Postman auto` — chạy `TC46 - ETA Model Version Is Returned`.
- `TC47` AI latency < 200ms — `Script/load` — cần đo thời gian lặp nhiều request.
- `TC48` Drift detection trigger — `Postman hybrid` — seed nhiều request `POST /eta/predict` rồi `GET /eta/drift`.
- `TC49` Model fallback khi lỗi — `Manual fault injection` — cần làm model/service lỗi có kiểm soát.
- `TC50` Input bất thường model không crash — `Postman auto` — chạy `TC50 - Outlier Input Does Not Crash ETA`.
- `TC51` Agent chọn driver gần nhất — `Manual/unsupported public API` — cần endpoint decision nội bộ hoặc logs quyết định.
- `TC52` Agent cân nhắc rating — `Manual/unsupported public API` — cần recommendation reasoning nội bộ.
- `TC53` Agent cân bằng ETA vs price — `Manual/unsupported public API` — cần endpoint multi-objective decision.
- `TC54` Agent gọi đúng tool — `Manual/log-based` — cần observability/trace nội bộ.
- `TC55` Agent xử lý thiếu context — `Manual/log-based` — cần quan sát fallback của agent.
- `TC56` Agent retry khi service lỗi — `Manual/log-based` — cần fault injection + logs.
- `TC57` Agent không chọn driver offline — `Postman hybrid` — có thể dùng `TC13` làm chứng minh gián tiếp.
- `TC58` Agent log decision đầy đủ — `Manual/log-based` — cần log reasoning/trace.
- `TC59` Agent xử lý nhiều request song song — `Script/load` — cần concurrency test.
- `TC60` Agent fallback rule-based khi AI fail — `Manual/log-based`.

## Level 7-8
- `TC61` 1000 req/s booking — `Script/load` — dùng k6/Artillery.
- `TC62` ETA service under load — `Script/load` — dùng k6/Artillery.
- `TC63` Pricing service under spike — `Script/load` — dùng k6/Artillery.
- `TC64` Kafka throughput test — `Script/load + Kafka metrics`.
- `TC65` DB connection pool exhaustion — `Script/load + DB metrics`.
- `TC66` Redis cache hit rate > 90% — `Infra/manual + metrics`.
- `TC67` API Gateway rate limit — `Postman hybrid` cho smoke check bằng `TC67/85/98 - Gateway Rate Limit Smoke Check`, còn xác minh thực sự cần `Script/load`.
- `TC68` P95 latency < 300ms — `Script/load + metrics`.
- `TC69` Load test giờ cao điểm — `Script/load`.
- `TC70` Auto scaling hoạt động — `Infra/manual`.
- `TC71` Driver service down -> fallback — `Manual fault injection` — dừng service rồi tạo booking.
- `TC72` Pricing timeout -> retry — `Manual fault injection` hoặc `Script`.
- `TC73` Kafka down -> buffer event — `Manual/infra`.
- `TC74` DB failover — `Infra/manual`.
- `TC75` Circuit breaker open — `Manual/infra` — gây lỗi lặp lại rồi xem `/rides/circuit-breakers` hoặc logs.
- `TC76` Partial system failure handling — `Manual fault injection`.
- `TC77` Retry exponential backoff — `Manual/log-based` hoặc script có timestamp.
- `TC78` Service mesh routing fail — `Infra/manual`.
- `TC79` Network partition test — `Infra/manual`.
- `TC80` Graceful degradation — `Manual fault injection`.

## Level 9-10
- `TC81` SQL injection attempt — `Postman auto/hybrid` — có thể thêm request login với payload SQLi; kỳ vọng 400/401. Chưa có request riêng trong collection hiện tại.
- `TC82` XSS input test — `Manual UI` — vì cần xác minh script không execute trên UI.
- `TC83` JWT tampering — `Postman auto` — chạy `TC83/92 - Tampered JWT -> 401`.
- `TC84` Unauthorized API access — `Postman auto` — chạy `TC84/89/95 - RBAC Forbidden`.
- `TC85` Rate limit attack — `Script/load` — request `TC67/85/98` chỉ là smoke check headers.
- `TC86` Replay attack idempotency — `Postman auto/hybrid` — dùng payment API với cùng `X-Idempotency-Key`; collection cũ Payment/Pricing có demo rõ hơn.
- `TC87` Data encryption at rest — `Infra/manual` — cần truy DB/storage.
- `TC88` mTLS communication — `Infra/manual`.
- `TC89` RBAC enforcement — `Postman auto` — `TC84/89/95 - RBAC Forbidden`.
- `TC90` Sensitive data masking — `Postman hybrid` — gọi payment fail/success rồi xem response và logs; collection cũ Payment/Pricing phù hợp hơn.
- `TC91` Request không có token — `Postman auto` — `TC18` đã cover cùng bản chất.
- `TC92` Token không hợp lệ — `Postman auto` — `TC83/92 - Tampered JWT -> 401`.
- `TC93` Token hết hạn — `Manual/script` — cần tạo JWT đã expired thực sự.
- `TC94` Service-to-service authentication mTLS — `Infra/manual`.
- `TC95` RBAC user không có quyền — `Postman auto` — `TC84/89/95 - RBAC Forbidden`.
- `TC96` Least privilege — `Manual/unsupported public API` — cần endpoint user data hạn chế rõ ràng hơn để demo.
- `TC97` API Gateway kiểm tra tất cả request — `Manual/infra` — cần policy chặn direct-to-service từ ngoài.
- `TC98` Rate limiting chống abuse — `Script/load`.
- `TC99` Data encryption in transit — `Infra/manual`.
- `TC100` Audit logging — `Manual/log-based` — cần xem login + API call logs.

## Level 11-12
- `TC101` Deploy service thành công — `Infra/manual`.
- `TC102` Health check endpoint — `Postman auto/hybrid` — dùng `GET /health`; request metrics/health trong collection hỗ trợ.
- `TC103` Environment variables đúng — `Infra/manual` — xem logs khởi động và compose/env.
- `TC104` Service connect database — `Infra/manual` — health + logs.
- `TC105` Service connect Kafka — `Infra/manual` — logs + event publish thực tế.
- `TC106` Rolling update zero downtime — `Infra/manual`.
- `TC107` Auto scaling HPA — `Infra/manual`.
- `TC108` Service mesh routing — `Infra/manual`.
- `TC109` Config sai -> fail fast — `Manual/infra` — khởi động service với ENV sai.
- `TC110` Rollback deployment — `Infra/manual`.
- `TC111` Logging đầy đủ request — `Manual/log-based`.
- `TC112` Structured logging format — `Manual/log-based`.
- `TC113` Metrics được expose — `Postman hybrid` — chạy `TC102/113 - Health And Metrics`.
- `TC114` Dashboard hiển thị đúng — `Infra/manual` — Grafana/Prometheus.
- `TC115` Distributed tracing hoạt động — `Infra/manual` — Jaeger hoặc trace backend.
- `TC116` Alert khi error rate cao — `Infra/manual`.
- `TC117` Alert khi latency cao — `Infra/manual`.
- `TC118` AI service monitoring — `Manual/infra` — metrics/log/drift endpoints.
- `TC119` Kafka monitoring — `Infra/manual`.
- `TC120` Resource monitoring CPU/Memory — `Infra/manual`.

## Cách demo ngắn gọn
1. Chạy toàn bộ phần `Postman auto` bằng Collection Runner.
2. Chạy folder `04 Hybrid / Integration Support` theo thứ tự khi cần demo các flow event-driven.
3. Với các case `Script/load`, dùng Newman/k6/Artillery và đính kèm báo cáo.
4. Với các case `Infra/manual`, demo bằng Docker/K8s dashboard, logs, Prometheus/Grafana/Jaeger.

## Ghi chú mapping quan trọng
- PDF có vài case mô tả nghiệp vụ lý tưởng hơn code hiện tại. Ví dụ `TC21` và `TC22` nói Booking tự gọi ETA/Pricing, nhưng repo hiện tại tạo booking bằng `pricingSnapshot` client gửi vào. Vì vậy các case này được phân loại `Postman hybrid`.
- Các case notification/Kafka/agent decision thường không thể chứng minh đầy đủ chỉ bằng một HTTP response. Chúng cần thêm logs, SSE stream, hoặc observability.
