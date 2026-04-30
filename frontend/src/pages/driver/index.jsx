import DriverLoginKycPage from "./DriverLoginKycPage";
import DriverOnlineTogglePage from "./DriverOnlineTogglePage";
import DriverIncomingRequestPage from "./DriverIncomingRequestPage";
import DriverPickupPage from "./DriverPickupPage";
import DriverInProgressPage from "./DriverInProgressPage";
import DriverChatPage from "./DriverChatPage";
import DriverCompletedPage from "./DriverCompletedPage";
import DriverHistoryPage from "./DriverHistoryPage";
import DriverWalletPage from "./DriverWalletPage";
import DriverProfilePage from "./DriverProfilePage";

export const normalizeDriverPath = (path) => {
  if (path === "/" || path === "") return "/driver/login";
  return path;
};

export const driverRoutes = [
  {
    path: "/driver/login",
    step: "1",
    label: "Login / KYC",
    description: "Hoàn tất hồ sơ",
    component: DriverLoginKycPage,
  },
  {
    path: "/driver/online",
    step: "2",
    label: "Online toggle",
    description: "Bật trạng thái nhận chuyến",
    component: DriverOnlineTogglePage,
  },
  {
    path: "/driver/incoming",
    step: "3",
    label: "Nhận chuyến (Incoming)",
    description: "Popup nhận chuyến đi",
    component: DriverIncomingRequestPage,
  },
  {
    path: "/driver/pickup",
    step: "4",
    label: "Dẫn đường đón khách",
    description: "Bản đồ dẫn đường tới điểm đón",
    component: DriverPickupPage,
  },
  {
    path: "/driver/inprogress",
    step: "5",
    label: "Theo dõi chuyến đi",
    description: "Hành trình chở khách",
    component: DriverInProgressPage,
  },
  {
    path: "/driver/completed",
    step: "6",
    label: "Kết thúc chuyến",
    description: "Tổng kết thu nhập chuyến đi",
    component: DriverCompletedPage,
  },
  {
    path: "/driver/history",
    step: "7",
    label: "Lịch sử chuyến đi",
    description: "Thu nhập & Hồ sơ",
    component: DriverHistoryPage,
  },
  {
    path: "/driver/chat",
    step: "Chat",
    label: "Nhắn tin",
    description: "Trang chat với khách hàng",
    component: DriverChatPage,
  },
  {
    path: "/driver/wallet",
    step: "8",
    label: "Ví X-Ride",
    description: "Quản lý thu nhập",
    component: DriverWalletPage,
  },
  {
    path: "/driver/profile",
    step: "9",
    label: "Tài khoản",
    description: "Cài đặt & Hồ sơ",
    component: DriverProfilePage,
  },
];
