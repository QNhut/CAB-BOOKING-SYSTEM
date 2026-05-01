import { useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { decodeToken } from "../../lib/jwt";
import { submitReview } from "../../api/review";
import { RatingStars } from "../../components/ui/RatingStars";
import { Button } from "../../components/ui/Button";
import toast from "react-hot-toast";

export function RatingPage() {
  const { rideId } = useParams<{ rideId: string }>();
  const [searchParams] = useSearchParams();
  const driverIdFromUrl = searchParams.get("driverId") || "";
  const { token } = useAuth();
  const nav = useNavigate();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const claims = token ? decodeToken(token) : null;
  const userId = claims?.sub || claims?.userId || "";

  async function handleSubmit() {
    if (!rideId) return;
    setLoading(true);
    try {
      await submitReview({
        rideId,
        reviewerId: userId,
        revieweeId: driverIdFromUrl || "driver",
        rating,
        comment: comment.trim() || undefined,
        tip: tip ? Number(tip) : undefined,
      });
      setSubmitted(true);
      toast.success("Thank you for your review!");
      setTimeout(() => nav("/user/history"), 1500);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-500">Your review has been submitted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-primary text-white px-6 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/user/history" className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-bold">Rate Your Ride</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⭐</div>
            <p className="text-sm text-gray-500">How was your ride?</p>
            <p className="text-xs text-gray-400 font-mono mt-1">{rideId?.slice(0, 16)}...</p>
          </div>

          <div className="flex justify-center mb-6">
            <RatingStars rating={rating} onChange={setRating} size="lg" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us about your experience..."
                rows={3}
                className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-indigo-500 outline-none resize-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip (VND, optional)</label>
              <input
                type="number"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-indigo-500 outline-none transition"
              />
              <div className="flex gap-2 mt-2">
                {[5000, 10000, 20000].map((v) => (
                  <button key={v} onClick={() => setTip(String(v))} className="px-3 py-1 bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-full text-xs font-medium transition">
                    {v.toLocaleString()}đ
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">
              Submit Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
