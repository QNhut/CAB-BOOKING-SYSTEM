import React, { useEffect, useMemo } from 'react';

const CustomerPaymentReturnPage = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  const responseCode = params.get('vnp_ResponseCode');
  const orderId = params.get('vnp_TxnRef') || sessionStorage.getItem('currentBookingId');
  const rawAmount = params.get('vnp_Amount');
  const transactionNo = params.get('vnp_TransactionNo');
  const bankCode = params.get('vnp_BankCode');
  const amount = rawAmount ? Math.round(Number(rawAmount) / 100) : null;
  const status = responseCode === '00' ? 'SUCCESS' : responseCode ? 'FAILED' : 'PENDING';

  useEffect(() => {
    if (orderId) {
      sessionStorage.setItem('currentBookingId', orderId);
    }

    if (status === 'SUCCESS') {
      sessionStorage.setItem('currentPaymentMethod', 'VNPAY');
      sessionStorage.setItem('currentPaymentStatus', 'PAID');
      return;
    }

    if (status === 'FAILED') {
      sessionStorage.removeItem('currentPaymentMethod');
      sessionStorage.removeItem('currentPaymentStatus');
    }
  }, [orderId, status]);

  const handlePrimaryAction = () => {
    if (status === 'SUCCESS') {
      window.navigateTo('/customer/searching');
      return;
    }

    sessionStorage.removeItem('currentBookingId');
    sessionStorage.removeItem('currentPaymentMethod');
    sessionStorage.removeItem('currentPaymentStatus');
    window.navigateTo(localStorage.getItem('token') ? '/customer/options' : '/customer/login');
  };

  const headerConfig = {
    SUCCESS: {
      title: 'Thanh toán VNPay thành công',
      subtitle: 'Đơn đặt xe đã được xác nhận thanh toán. Bạn có thể tiếp tục sang bước tìm tài xế.',
      icon: 'check_circle',
      iconClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      buttonLabel: 'TIẾP TỤC TÌM TÀI XẾ',
      buttonClassName: 'bg-emerald-600 hover:bg-emerald-700',
    },
    FAILED: {
      title: 'Thanh toán VNPay không thành công',
      subtitle: `VNPay trả về mã ${responseCode || '--'}. Bạn có thể chọn lại phương thức thanh toán hoặc thử lại sau.`,
      icon: 'error',
      iconClassName: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      buttonLabel: 'QUAY LẠI CHỌN XE',
      buttonClassName: 'bg-rose-600 hover:bg-rose-700',
    },
    PENDING: {
      title: 'Đang xử lý thanh toán',
      subtitle: 'Kết quả thanh toán chưa sẵn sàng. Bạn có thể đợi thêm hoặc quay lại ứng dụng.',
      icon: 'hourglass_empty',
      iconClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      buttonLabel: 'VỀ ỨNG DỤNG',
      buttonClassName: 'bg-blue-600 hover:bg-blue-700',
    },
  }[status];

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800 px-6 pt-16 pb-8">
      <div className="text-center mb-8">
        <div className={`w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center ${headerConfig.iconClassName}`}>
          <span className="material-symbols-outlined text-[40px]">{headerConfig.icon}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{headerConfig.title}</h1>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{headerConfig.subtitle}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Mã booking / đơn hàng</span>
          <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">{orderId || 'Chưa xác định'}</span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Số tiền</span>
          <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{amount ? `${amount.toLocaleString('vi-VN')}đ` : 'Đang chờ VNPay xác nhận'}</span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Ngân hàng / Kênh</span>
          <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{bankCode || 'VNPay'}</span>
        </div>

        {transactionNo && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Mã giao dịch</span>
            <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{transactionNo}</span>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 space-y-3">
        <button
          type="button"
          onClick={handlePrimaryAction}
          className={`w-full py-4 text-white font-bold rounded-2xl text-sm shadow-lg transition-colors ${headerConfig.buttonClassName}`}
        >
          {headerConfig.buttonLabel}
        </button>

        <button
          type="button"
          onClick={() => window.navigateTo(localStorage.getItem('token') ? '/customer/home' : '/customer/login')}
          className="w-full py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
        >
          VỀ TRANG CHỦ
        </button>
      </div>
    </div>
  );
};

export default CustomerPaymentReturnPage;