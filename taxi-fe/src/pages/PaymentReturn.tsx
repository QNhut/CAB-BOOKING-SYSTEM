import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createBooking } from "../api/booking";
import {
  clearPendingVnpayBookingDraft,
  loadPendingVnpayBookingDraft,
  verifyVnpayReturn,
} from "../api/payment";

export function PaymentReturn() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"SUCCESS" | "FAILED" | "PENDING">("PENDING");
  const [message, setMessage] = useState("Dang xu ly ket qua thanh toan...");
  const [bookingId, setBookingId] = useState<string | null>(null);

  const rspCode = params.get("vnp_ResponseCode");
  const orderId = params.get("vnp_TxnRef");
  const rawAmt = params.get("vnp_Amount");
  const bank = params.get("vnp_BankCode");
  const txnNo = params.get("vnp_TransactionNo");
  const amount = rawAmt ? Math.round(Number(rawAmt) / 100) : null;

  useEffect(() => {
    let cancelled = false;

    async function finalizeBooking() {
      if (!rspCode) return;

      if (rspCode !== "00") {
        setStatus("FAILED");
        setMessage(`Thanh toan that bai (ma loi: ${rspCode}). Booking chua duoc tao.`);
        return;
      }

      if (!orderId) {
        setStatus("FAILED");
        setMessage("Thieu ma giao dich VNPay. Booking chua duoc tao.");
        return;
      }

      try {
        const verified = await verifyVnpayReturn(Object.fromEntries(params.entries()));
        if (!verified.success) {
          setStatus("FAILED");
          setMessage("Khong xac minh duoc giao dich VNPay. Booking chua duoc tao.");
          return;
        }

        const draft = loadPendingVnpayBookingDraft(orderId);
        if (!draft) {
          setStatus("SUCCESS");
          setMessage("Thanh toan thanh cong. Khong tim thay du lieu booking tam de tao booking.");
          return;
        }

        const booking = await createBooking({
          userId: draft.userId ?? null,
          pickup: draft.pickup,
          dropoff: draft.dropoff,
          vehicleType: draft.vehicleType,
          paymentMethod: "VNPAY",
          paymentStatus: "PAID",
          pricingSnapshot: draft.pricingSnapshot,
        }, {
          idempotencyKey: `vnpay:${orderId}`,
        });

        if (cancelled) return;

        clearPendingVnpayBookingDraft(orderId);
        setBookingId(booking.bookingId || null);
        setStatus("SUCCESS");
        setMessage("Thanh toan thanh cong va booking da duoc tao.");
      } catch (error: any) {
        if (cancelled) return;
        setStatus("FAILED");
        setMessage(
          error?.response?.data?.error ||
          error?.message ||
          "Khong the tao booking sau khi thanh toan."
        );
      }
    }

    finalizeBooking();
    return () => {
      cancelled = true;
    };
  }, [orderId, params, rspCode]);

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
        {isPending && <div style={iconStyle}>...</div>}
        {isSuccess && <div style={iconStyle}>OK</div>}
        {!isPending && !isSuccess && <div style={iconStyle}>X</div>}

        <h2 style={{
          margin: "0 0 8px",
          color: isSuccess ? "#2e7d32" : isPending ? "#555" : "#b71c1c",
          fontSize: 24,
          fontWeight: 700,
        }}>
          {isPending && "Dang xu ly..."}
          {isSuccess && "Thanh toan thanh cong!"}
          {!isPending && !isSuccess && "Thanh toan that bai"}
        </h2>

        {!isPending && (
          <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
            {message}
          </p>
        )}

        {(orderId || amount || bank || txnNo || bookingId) && (
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
                  <td style={{ padding: "6px 0", color: "#888", width: "45%" }}>Ma giao dich</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{orderId}</td>
                </tr>
              )}
              {bookingId && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Booking ID</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{bookingId}</td>
                </tr>
              )}
              {amount !== null && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>So tien</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>
                    {amount.toLocaleString("vi-VN")} VND
                  </td>
                </tr>
              )}
              {bank && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Ngan hang</td>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{bank}</td>
                </tr>
              )}
              {txnNo && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#888" }}>Ma VNPay</td>
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
          Ve trang dat xe
        </Link>
      </div>
    </div>
  );
}
