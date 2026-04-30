import CustomerOnboardingPage from "./CustomerOnboardingPage";
import CustomerLoginPage from "./CustomerLoginPage";
import CustomerRegisterPage from "./CustomerRegisterPage";
import CustomerHomePage from "./CustomerHomePage";
import CustomerDestinationPage from "./CustomerDestinationPage";
import CustomerRideOptionsPage from "./CustomerRideOptionsPage";
import CustomerSearchingPage from "./CustomerSearchingPage";
import CustomerTrackingPage from "./CustomerTrackingPage";
import CustomerPaymentPage from "./CustomerPaymentPage";
import CustomerPaymentReturnPage from "./CustomerPaymentReturnPage";
import CustomerHistoryPage from "./CustomerHistoryPage";
import CustomerProfilePage from "./CustomerProfilePage";

export const customerRoutes = [
  {
    path: "/customer/onboarding",
    step: "C1",
    label: "Splash / Onboarding",
    description: "Giới thiệu & quyền truy cập",
    component: CustomerOnboardingPage,
  },
  {
    path: "/customer/login",
    step: "C1.5",
    label: "Customer Login",
    description: "Đăng nhập khách hàng",
    component: CustomerLoginPage,
  },
  {
    path: "/customer/register",
    step: "C1.6",
    label: "Customer Register",
    description: "Đăng ký khách hàng",
    component: CustomerRegisterPage,
  },
  {
    path: "/customer/home",
    step: "C2",
    label: "Home - Map & Pickup",
    description: "Đặt điểm đón",
    component: CustomerHomePage,
  },
  {
    path: "/customer/destination",
    step: "C3",
    label: "Destination",
    description: "Nhập điểm đến",
    component: CustomerDestinationPage,
  },
  {
    path: "/customer/options",
    step: "C4",
    label: "Ride Options",
    description: "Chọn loại xe & giá",
    component: CustomerRideOptionsPage,
  },
  {
    path: "/customer/searching",
    step: "C5",
    label: "Searching Driver",
    description: "Matching real-time",
    component: CustomerSearchingPage,
  },
  {
    path: "/customer/tracking",
    step: "C6",
    label: "Ride Tracking",
    description: "Theo dõi chuyến đi",
    component: CustomerTrackingPage,
  },
  {
    path: "/customer/payment",
    step: "C7",
    label: "Payment & Rating",
    description: "Thanh toán & Đánh giá",
    component: CustomerPaymentPage,
  },
  {
    path: "/customer/payment-return",
    step: "C7.5",
    label: "VNPay Return",
    description: "Kết quả thanh toán VNPay",
    component: CustomerPaymentReturnPage,
  },
  {
    path: "/customer/history",
    step: "C8",
    label: "Ride History",
    description: "Lịch sử chuyến đi",
    component: CustomerHistoryPage,
  },
  {
    path: "/customer/profile",
    step: "C9",
    label: "Profile & Wallet",
    description: "Thông tin cá nhân & Ví",
    component: CustomerProfilePage,
  },
];
