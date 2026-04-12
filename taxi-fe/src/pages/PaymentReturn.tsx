import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

/**
 * VNPay redirects the browser here after the user finishes (or cancels) payment.
 * URL looks like: /payment/return?vnp_ResponseCode=00&vnp_TxnRef=...&vnp_Amount=...&...
 *
 * We only READ the query params here — the authoritative update is done
 * server-side via the IPN callback (→ Kafka → SSE).
 */
export function PaymentReturn() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"SUCCESS" | "FAILED" | "PENDING">("PENDING");

  const rspCode  = params.get("vnp_ResponseCode");
  const orderId  = params.get("vnp_TxnRef");
  const rawAmt   = params.get("vnp_Amount");   // VNPay sends amount × 100
  const bank     = params.get("vnp_BankCode");
  const txnNo    = params.get("vnp_TransactionNo");
  const amount   = rawAmt ? Math.round(Number(rawAmt) / 100) : null;

  useEffect(() => {
    if (rspCode === "00") setStatus("SUCCESS");
    else if (rspCode !== null) setStatus("FAILED");
  }, [rspCode]);

  const isPending = status === "PENDING";
  const isSuccess = status === "SUCCESS";

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isSuccess
      ? "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)"
      : isPending
        ? "#f5f5f5"
        : "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 48px",
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
    textAlign: "center",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 64,
    marginBottom: 16,
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {isPending && <div style={iconStyle}>⏳</div>}
        {isSuccess && <div style={iconStyle}>✅</div>}
        {!isPending && !isSuccess && <div style={iconStyle}>❌</div>}

        <h2 style={{
          margin: "0 0 8px",
          color: isSuccess ? "#2e7d32" : isPending ? "#555" : "#b71c1c",
          fontSize: 24,
          fontWeight: 700,
        }}>
          {isPending && "Đang xử lý…"}
          {isSuccess && "Thanh toán thành công!"}
          {!isPending && !isSuccess && "Thanh toán thất bại"}
        </h2>

        {!isPending && (
          <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
            {isSuccess
              ? "Giao dịch của bạn đã được xác nhận. Bạn có thể đóng tab này."
              : `Giao dịch không thành công (mã lỗi: ${rspCode}). Vui lòng thử lại.`}
          </p>
        )}

        {/* Order detail table */}
        {(orderId || amount || bank || txnNo) && (
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 28,
            fontSize: 14,
            textAlign: "left",
          }}>
            <tbody>
              {orderId && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888", width: "45%" }}>Mã đơn hàng</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{orderId}</td>
                </tr>
              )}
              {amount !== null && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Số tiền</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>
                    {amount.toLocaleString("vi-VN")} ₫
                  </td>
                </tr>
              )}
              {bank && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Ngân hàng</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{bank}</td>
                </tr>
              )}
              {txnNo && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Mã giao dịch</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{txnNo}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <Link
          to="/user"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            background: isSuccess ? "#4CAF50" : "#1976d2",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          ← Về trang đặt xe
        </Link>
      </div>
    </div>
  );
}
