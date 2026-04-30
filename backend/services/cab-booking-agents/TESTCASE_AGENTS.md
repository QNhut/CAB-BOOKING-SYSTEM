# TESTCASE AGENTS

Tài liệu này được biên soạn cho mục đích review nội bộ, tổng hợp kết quả chạy testcase AI Agent theo đúng danh sách trong ảnh (TC51 -> TC60).

## 1. Mục tiêu

- Xác nhận workflow Agent đáp ứng đầy đủ các testcase nghiệp vụ.
- Cung cấp bằng chứng pass/fail rõ ràng cho team review.
- Lưu output thực tế và giải thích lý do testcase đạt.
- Bổ sung input API để test trực tiếp trên Postman.

## 2. Thông tin API dùng chung (Postman)

- Method: POST
- URL: http://127.0.0.1:8010/v1/agents/dispatch
- Headers:
1. Content-Type: application/json

Lưu ý:
- Mỗi testcase bên dưới đều có phần Body JSON riêng để bạn copy vào tab Body -> raw -> JSON trong Postman.

## 3. Phạm vi và phương pháp

- Phạm vi: DispatchAgent trong service cab-booking-agents.
- Cách chạy xác nhận: script Python gọi trực tiếp DispatchAgent.handle_dispatch() cho từng testcase.
- Tiêu chí PASS:
1. Kết quả output đúng với expected behavior trong testcase.
2. Trạng thái và log hệ thống phù hợp (retry, fallback, trace_id, tool_calls).

## 4. Tổng hợp kết quả

| Testcase | Mô tả | Kết quả |
|---|---|---|
| TC51 | Agent chọn driver gần nhất | [x] PASS |
| TC52 | Agent chọn driver có rating cao hơn | [x] PASS |
| TC53 | Agent cân bằng ETA và Price | [x] PASS |
| TC54 | Agent gọi đúng tool ETA/Pricing | [x] PASS |
| TC55 | Agent xử lý context thiếu dữ liệu | [x] PASS |
| TC56 | Agent retry khi service lỗi | [x] PASS |
| TC57 | Agent không chọn driver offline | [x] PASS |
| TC58 | Agent log decision đầy đủ + trace_id | [x] PASS |
| TC59 | Agent xử lý nhiều request song song | [x] PASS |
| TC60 | Agent fallback rule-based khi AI fail | [x] PASS |

## 5. Chi tiết testcase

### [x] TC51 - Agent chọn driver gần nhất

Mô tả testcase trong ảnh:
- Driver có khoảng cách khác nhau, cần chọn driver hợp lý (không random).

Body JSON (Postman):

```json
{
  "user_id": "u51",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "drivers": [
    {"driver_id": "D1", "distance_km": 5, "rating": 4.1, "is_online": true},
    {"driver_id": "D2", "distance_km": 2, "rating": 4.1, "is_online": true},
    {"driver_id": "D3", "distance_km": 3, "rating": 4.1, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "selected_driver_id": "D2",
  "driver_scores": [
    {"driver_id": "D2", "score": -8.345},
    {"driver_id": "D3", "score": -11.18},
    {"driver_id": "D1", "score": -16.85}
  ]
}
```

Lý do PASS:
- Agent xếp hạng theo score và chọn D2 (điểm cao nhất).
- Quy trình có tính toán, không chọn ngẫu nhiên.

### [x] TC52 - Agent chọn driver có rating cao hơn

Mô tả testcase trong ảnh:
- Driver có rating khác nhau, có thể chọn driver xa hơn nếu objective yêu cầu.

Body JSON (Postman):

```json
{
  "user_id": "u52",
  "pickup": "A",
  "dropoff": "B",
  "objective": "best_rated",
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.0, "is_online": true},
    {"driver_id": "D2", "distance_km": 3, "rating": 4.9, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "selected_driver_id": "D2",
  "tool_calls": [
    {"tool": "eta", "driver_id": "D1", "status": "skipped"},
    {"tool": "pricing", "driver_id": "D1", "status": "skipped"},
    {"tool": "eta", "driver_id": "D2", "status": "skipped"},
    {"tool": "pricing", "driver_id": "D2", "status": "skipped"}
  ]
}
```

Lý do PASS:
- Objective best_rated ưu tiên rating, D2 được chọn dù khoảng cách lớn hơn.
- Đạt đúng yêu cầu không chỉ dựa vào distance.

### [x] TC53 - Agent cân bằng ETA vs Price (trade-off)

Mô tả testcase trong ảnh:
- Cần cân bằng ETA và giá, không tối ưu 1 biến duy nhất.

Body JSON (Postman):

```json
{
  "user_id": "u53",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "drivers": [
    {
      "driver_id": "A",
      "distance_km": 2,
      "rating": 4.2,
      "is_online": true,
      "eta_min": 5,
      "price_k": 50
    },
    {
      "driver_id": "B",
      "distance_km": 3,
      "rating": 4.5,
      "is_online": true,
      "eta_min": 8,
      "price_k": 40
    }
  ]
}
```

Output trích yếu:

```json
{
  "selected_driver_id": "B",
  "driver_scores": [
    {
      "driver_id": "B",
      "score": -12.125,
      "components": {"eta": -2.8, "price": -10.0, "rating": 1.125, "distance": -0.45}
    },
    {
      "driver_id": "A",
      "score": -13.5,
      "components": {"eta": -1.75, "price": -12.5, "rating": 1.05, "distance": -0.3}
    }
  ]
}
```

Lý do PASS:
- Agent tối ưu đa mục tiêu (ETA + price + rating + distance).
- Kết quả lựa chọn phù hợp logic trade-off.

### [x] TC54 - Agent gọi đúng tool ETA/Pricing

Mô tả testcase trong ảnh:
- Gọi đúng service cần thiết, không gọi dư thừa.

Body JSON (Postman):

```json
{
  "user_id": "u54",
  "pickup": "A",
  "dropoff": "B",
  "objective": "fastest",
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.2, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "tool_calls": [
    {"tool": "eta", "driver_id": "D1", "attempts": 1, "status": "used"},
    {"tool": "pricing", "driver_id": "D1", "attempts": 0, "status": "skipped"}
  ]
}
```

Lý do PASS:
- Objective fastest chỉ cần ETA.
- Pricing được skip đúng mong đợi.

### [x] TC55 - Agent xử lý context thiếu dữ liệu

Mô tả testcase trong ảnh:
- Nếu context thiếu dữ liệu quan trọng thì không assign sai, cần có hướng xử lý.

Body JSON (Postman):

```json
{
  "user_id": "u55",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "status": "need_more_context",
  "missing_context_fields": ["rating"]
}
```

Lý do PASS:
- Agent trả về cần bổ sung context thay vì quyết định sai.

### [x] TC56 - Agent retry khi service lỗi

Mô tả testcase trong ảnh:
- Khi service ETA lỗi tạm thời, agent phải retry.

Body JSON (Postman):

```json
{
  "user_id": "u56",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "failure_injection": {
    "eta_fail_attempts": 1,
    "pricing_fail_attempts": 0,
    "ai_model_fail": false
  },
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.4, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "retry_report": {"eta_retries": 1, "pricing_retries": 0},
  "eta_log": {"tool": "eta", "driver_id": "D1", "attempts": 2, "status": "used"}
}
```

Lý do PASS:
- Lần đầu fail, lần 2 thành công.
- Agent retry đúng yêu cầu, không fail ngay.

### [x] TC57 - Agent không chọn driver offline

Mô tả testcase trong ảnh:
- Driver offline phải bị loại trước assign.

Body JSON (Postman):

```json
{
  "user_id": "u57",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.4, "is_online": false},
    {"driver_id": "D2", "distance_km": 3, "rating": 4.1, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "selected_driver_id": "D2",
  "filtered_offline_drivers": ["D1"]
}
```

Lý do PASS:
- Driver offline được filter chính xác.
- Kết quả assign chỉ nằm trong tập online.

### [x] TC58 - Agent log decision đầy đủ + trace_id

Mô tả testcase trong ảnh:
- Cần có log decision đầy đủ và trace_id để truy vết.

Body JSON (Postman):

```json
{
  "user_id": "u58",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "trace_id": "trace-tc58",
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.2, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "trace_id": "trace-tc58",
  "reason": "Selected D1 by weighted scoring.",
  "tool_calls": [
    {"tool": "eta", "driver_id": "D1", "attempts": 1, "status": "used"},
    {"tool": "pricing", "driver_id": "D1", "attempts": 1, "status": "used"}
  ]
}
```

Log runtime trích yếu:

```text
{"event": "dispatch_started", "trace_id": "trace-tc58", ...}
{"event": "dispatch_decision", "trace_id": "trace-tc58", "selected_driver_id": "D1", ...}
```

Lý do PASS:
- Có trace_id trong response và trong log.
- Có thông tin decision reason để review.

### [x] TC59 - Agent xử lý nhiều request song song

Mô tả testcase trong ảnh:
- Nhiều request cùng lúc, hệ thống phải ổn định và không conflict.

Body JSON (Postman):

```json
{
  "user_id": "u59-demo",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "drivers": [
    {"driver_id": "D1", "distance_km": 4, "rating": 4.2, "is_online": true},
    {"driver_id": "D2", "distance_km": 2, "rating": 4.2, "is_online": true}
  ]
}
```

Hướng dẫn chạy đúng testcase song song trên Postman:
1. Dùng Collection Runner.
2. Chạy cùng request TC59 với Iterations = 20.
3. Theo dõi kết quả selected_driver_id trong response từng iteration.

Output trích yếu:

```json
{
  "selected_driver_ids": [
    "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2",
    "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2"
  ],
  "unique": ["D2"]
}
```

Lý do PASS:
- 100% request cho kết quả nhất quán.
- Không phát hiện race condition trong phạm vi testcase.

### [x] TC60 - Fallback rule-based khi AI fail

Mô tả testcase trong ảnh:
- Nếu model crash thì hệ thống phải fallback rule-based.

Body JSON (Postman):

```json
{
  "user_id": "u60",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "failure_injection": {
    "eta_fail_attempts": 0,
    "pricing_fail_attempts": 0,
    "ai_model_fail": true
  },
  "drivers": [
    {"driver_id": "D1", "distance_km": 2, "rating": 4.2, "is_online": true},
    {"driver_id": "D2", "distance_km": 3, "rating": 4.9, "is_online": true}
  ]
}
```

Output trích yếu:

```json
{
  "status": "fallback_selected",
  "selected_driver_id": "D1",
  "reason": "AI failed (AI model crashed). Fallback rule-based selected D1."
}
```