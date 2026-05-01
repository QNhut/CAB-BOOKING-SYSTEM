import { http } from "../lib/http";
import { ENV } from "../lib/env";

export async function submitReview(data: {
  rideId: string;
  reviewerId: string;
  reviewerRole?: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  tip?: number;
}) {
  const res = await http.post(`${ENV.REVIEW_URL}/reviews`, {
    ride_id: data.rideId,
    reviewer_id: data.reviewerId,
    reviewer_role: data.reviewerRole || "USER",
    reviewee_id: data.revieweeId,
    rating: data.rating,
    comment: data.comment,
    tip_amount: data.tip,
  });
  return res.data;
}

export async function getReviewsByRide(rideId: string) {
  const res = await http.get(`${ENV.REVIEW_URL}/reviews/ride/${rideId}`);
  return res.data;
}

export async function getReviewsByUser(userId: string) {
  const res = await http.get(`${ENV.REVIEW_URL}/reviews/user/${userId}`);
  return res.data;
}

export async function getDriverAverageRating(driverId: string) {
  const res = await http.get(`${ENV.REVIEW_URL}/reviews/driver/${driverId}/average`);
  return res.data;
}
