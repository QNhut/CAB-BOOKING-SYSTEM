import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

const DEFAULT_PICKUP = { lat: 10.7950, lng: 106.7220, address: "Landmark 81" };
const DEFAULT_DROPOFF = { lat: 10.7726, lng: 106.6980, address: "Chợ Bến Thành" };

const RIDE_OPTIONS = {
  car4: {
    vehicleType: 'CAR_4',
    title: 'X-Ride Car 4 chỗ',
    seats: 4,
    etaMinutes: 8,
    image: 'https://cdn-icons-png.flaticon.com/512/3204/3204121.png',
    imageClassName: 'w-12 h-12 object-contain opacity-80',
  },
  car7: {
    vehicleType: 'CAR_7',
    title: 'X-Ride Car 7 chỗ',
    seats: 7,
    etaMinutes: 10,
    image: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
    imageClassName: 'w-12 h-12 object-contain opacity-90',
  },
};

const PAYMENT_OPTIONS = [
  {
    id: 'CASH',
    label: 'Tiền mặt',
    description: 'Thanh toán khi kết thúc chuyến đi',
    icon: 'payments',
    accentClassName: 'text-emerald-600',
  },
  {
    id: 'VNPAY',
    label: 'VNPay',
    description: 'Thanh toán online trước khi bắt đầu ghép tài xế',
    icon: 'account_balance',
    accentClassName: 'text-blue-600',
  },
];

const readResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { error: text, message: text } : {};
};

// Normalize a lat/lng value that may have come back as a string
const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const formatDist = (m) => {
  if (!m) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
};

const formatDuration = (s) => {
  if (!s) return '';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
};

const CustomerRideOptionsPage = () => {
  const [selectedRide, setSelectedRide] = useState('car4');
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('CASH');

  const [pricingMap, setPricingMap] = useState({
    car4: { fare: 0, distanceM: 0, durationS: 0 },
    car7: { fare: 0, distanceM: 0, durationS: 0 }
  });
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [pricingError, setPricingError] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Read and normalize pickup/dropoff — ensure lat/lng are always numbers
  const rawPickup = (() => { try { return JSON.parse(sessionStorage.getItem('pickup')) || DEFAULT_PICKUP; } catch { return DEFAULT_PICKUP; } })();
  const rawDropoff = (() => { try { return JSON.parse(sessionStorage.getItem('dropoff')) || DEFAULT_DROPOFF; } catch { return DEFAULT_DROPOFF; } })();

  const pickup = {
    ...rawPickup,
    lat: toNum(rawPickup.lat) ?? DEFAULT_PICKUP.lat,
    lng: toNum(rawPickup.lng) ?? DEFAULT_PICKUP.lng,
  };
  const dropoff = {
    ...rawDropoff,
    lat: toNum(rawDropoff.lat) ?? DEFAULT_DROPOFF.lat,
    lng: toNum(rawDropoff.lng) ?? DEFAULT_DROPOFF.lng,
  };
  
  const routeLine = [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
  const mapCenter = [(pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2];

  useEffect(() => {
    sessionStorage.setItem('currentPaymentMethod', selectedPaymentMethod);
  }, [selectedPaymentMethod]);

  const loadPricing = async () => {
    setLoadingPrice(true);
    setPricingError(false);

    const fetchOne = async (vehicleType, typeKey) => {
      const body = { pickup: { lat: pickup.lat, lng: pickup.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng }, vehicleType };
      console.log('[Pricing] Request:', JSON.stringify(body));
      try {
        const res = await fetch('/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await readResponsePayload(res);
        console.log(`[Pricing] Response ${vehicleType}:`, data);
        if (res.ok && data.fare) {
          setPricingMap(prev => ({
            ...prev,
            [typeKey]: {
              fare: data.fare,
              distanceM: data.distanceM || 0,
              durationS: data.durationS || 0,
              currency: data.currency || 'VND',
              routeSource: data.routeSource,
            }
          }));
        } else {
          console.error(`[Pricing] Error ${vehicleType}:`, data.error || data);
          return false;
        }
        return true;
      } catch (err) {
        console.error('[Pricing] Network error:', err);
        return false;
      }
    };

    const results = await Promise.all([
      fetchOne(RIDE_OPTIONS.car4.vehicleType, 'car4'),
      fetchOne(RIDE_OPTIONS.car7.vehicleType, 'car7'),
    ]);

    if (!results.every(Boolean)) setPricingError(true);
    setLoadingPrice(false);
  };

  useEffect(() => { loadPricing(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBookRide = async () => {
    setBookingLoading(true);
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const vehicleType = RIDE_OPTIONS[selectedRide].vehicleType;
    const snapshot = pricingMap[selectedRide];

    if (!snapshot?.fare) {
      alert('Chưa lấy được giá chuyến đi. Vui lòng thử lại.');
      setBookingLoading(false);
      return;
    }

    try {
      const res = await fetch('/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pickup,
          dropoff,
          vehicleType,
          paymentMethod: selectedPaymentMethod,
          pricingSnapshot: snapshot
        })
      });

      if (res.ok) {
        const data = await readResponsePayload(res);
        const bookingId = data.bookingId || data.booking_id;

        if (!bookingId) {
          throw new Error('Booking response missing bookingId');
        }

        sessionStorage.setItem('currentBookingId', bookingId);
        sessionStorage.setItem('currentPaymentMethod', selectedPaymentMethod);
        sessionStorage.setItem('tripPrice', String(snapshot.fare || 0));

        if (selectedPaymentMethod === 'VNPAY') {
          const paymentRes = await fetch('/payment/order/create_payment_url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: bookingId,
              amount: snapshot.fare,
              userId,
              language: 'vn',
              returnUrl: `${window.location.origin}/customer/payment-return`,
            })
          });

          const paymentData = await readResponsePayload(paymentRes);

          if (!paymentRes.ok || !paymentData.paymentUrl) {
            try {
              await fetch(`/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
            } catch (cancelError) {
              console.error('Cancel failed after VNPay init error', cancelError);
            }

            sessionStorage.removeItem('currentBookingId');
            sessionStorage.removeItem('currentPaymentMethod');

            throw new Error(paymentData.error || paymentData.message || 'Không tạo được link thanh toán VNPay');
          }

          window.location.href = paymentData.paymentUrl;
          return;
        }

        window.navigateTo('/customer/searching');
      } else {
        const err = await readResponsePayload(res);
        alert(`Không thể đặt xe: ${err.error || err.message || 'Lỗi hệ thống'}`);
        setBookingLoading(false);
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối máy chủ');
      setBookingLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      <LeafletMap
        center={mapCenter}
        zoom={13}
        markers={[
          { lat: pickup.lat, lng: pickup.lng, color: '#3b82f6', label: 'Điểm đón' },
          { lat: dropoff.lat, lng: dropoff.lng, color: '#ef4444', label: 'Điểm đến' },
        ]}
        routeLine={routeLine}
        className="absolute inset-0 w-full h-[48%]"
      />

      <div className="absolute top-4 left-4 z-10">
        <button onClick={() => window.navigateTo('/customer/destination')} className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </div>

      <div className="absolute bottom-0 w-full z-20 bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col h-[55%]">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

        {/* Route summary strip */}
        <div className="px-4 pb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-blue-600 truncate max-w-[38%]">{pickup.address || pickup.name}</span>
          <span className="material-symbols-outlined text-[14px] shrink-0">arrow_forward</span>
          <span className="font-semibold text-rose-600 truncate max-w-[38%]">{dropoff.address || dropoff.name}</span>
          {pricingMap.car4.distanceM > 0 && (
            <span className="ml-auto shrink-0 font-bold text-slate-700 dark:text-slate-300">
              {formatDist(pricingMap.car4.distanceM)}
            </span>
          )}
        </div>

        {/* Error banner */}
        {pricingError && (
          <div className="mx-4 mt-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span>
            <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">Không tải được giá. Kiểm tra kết nối.</p>
            <button onClick={loadPricing} className="text-xs font-bold text-amber-700 dark:text-amber-300 underline">
              Thử lại
            </button>
          </div>
        )}

        <div className="flex-grow overflow-y-auto px-4 py-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Chọn xe</h2>
          
          <div className="space-y-3">
            <div 
              onClick={() => setSelectedRide('car4')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-4 transition-all cursor-pointer ${selectedRide === 'car4' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent bg-slate-50 dark:bg-slate-800'}`}
            >
              <img src={RIDE_OPTIONS.car4.image} alt="Car 4" className={RIDE_OPTIONS.car4.imageClassName} />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">{RIDE_OPTIONS.car4.title}</h3>
                  <span className="material-symbols-outlined text-[14px] text-slate-500">person</span>
                  <span className="text-xs font-bold text-slate-500">{RIDE_OPTIONS.car4.seats}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pricingMap.car4.distanceM > 0
                    ? `${formatDist(pricingMap.car4.distanceM)} • ${formatDuration(pricingMap.car4.durationS)}`
                    : `~${RIDE_OPTIONS.car4.etaMinutes} phút • Ô tô 4 chỗ`
                  }
                </p>
              </div>
              <div className="text-right shrink-0">
                {loadingPrice ? (
                  <div className="w-16 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  <p className="font-black text-lg text-slate-900 dark:text-white">{(pricingMap.car4.fare || 0).toLocaleString('vi-VN')}đ</p>
                )}
                {selectedRide === 'car4' && <p className="text-[10px] text-blue-600 font-bold">Phổ biến nhất</p>}
              </div>
            </div>

            <div 
              onClick={() => setSelectedRide('car7')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-4 transition-all cursor-pointer ${selectedRide === 'car7' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent bg-slate-50 dark:bg-slate-800'}`}
            >
              <img src={RIDE_OPTIONS.car7.image} alt="Car 7" className={RIDE_OPTIONS.car7.imageClassName} />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">{RIDE_OPTIONS.car7.title}</h3>
                  <span className="material-symbols-outlined text-[14px] text-slate-500">person</span>
                  <span className="text-xs font-bold text-slate-500">{RIDE_OPTIONS.car7.seats}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pricingMap.car7.distanceM > 0
                    ? `${formatDist(pricingMap.car7.distanceM)} • ${formatDuration(pricingMap.car7.durationS)}`
                    : `~${RIDE_OPTIONS.car7.etaMinutes} phút • Ô tô 7 chỗ`
                  }
                </p>
              </div>
              <div className="text-right shrink-0">
                {loadingPrice ? (
                  <div className="w-16 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  <p className="font-black text-lg text-slate-900 dark:text-white">{(pricingMap.car7.fare || 0).toLocaleString('vi-VN')}đ</p>
                )}
              </div>
            </div>
          </div>

          <div 
            onClick={() => setIsPaymentSheetOpen(true)}
            className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined ${selectedPaymentMethod === 'VNPAY' ? 'text-blue-600' : 'text-green-600'}`}>
                {selectedPaymentMethod === 'VNPAY' ? 'account_balance' : 'payments'}
              </span>
              <div>
                <span className="font-bold text-sm block">{selectedPaymentMethod === 'VNPAY' ? 'VNPay' : 'Tiền mặt'}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedPaymentMethod === 'VNPAY' ? 'Thanh toán online trước khi ghép tài xế' : 'Thanh toán sau khi kết thúc chuyến'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-blue-600 font-bold">Chọn phương thức</span>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe">
          <button 
            onClick={handleBookRide}
            disabled={bookingLoading || loadingPrice}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {bookingLoading ? (
              <>
                 <span className="material-symbols-outlined animate-spin" style={{animation: 'spin 1s linear infinite'}}>refresh</span>
                 ĐANG ĐẶT XE...
              </>
            ) : (
              `${selectedPaymentMethod === 'VNPAY' ? 'THANH TOÁN ' : 'ĐẶT XE '}${RIDE_OPTIONS[selectedRide].title.toUpperCase()} • ${(pricingMap[selectedRide].fare || 0).toLocaleString('vi-VN')}đ`
            )}
          </button>
        </div>
      </div>

      {isPaymentSheetOpen && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsPaymentSheetOpen(false)}></div>
          <div className="relative w-full h-[60%] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Chọn phương thức thanh toán</h3>
              <button onClick={() => setIsPaymentSheetOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {PAYMENT_OPTIONS.map((option) => (
                <div 
                  key={option.id}
                  onClick={() => {
                    setSelectedPaymentMethod(option.id);
                    setIsPaymentSheetOpen(false);
                  }}
                  className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${selectedPaymentMethod === option.id ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 ${option.accentClassName}`}>
                    <span className="material-symbols-outlined">{option.icon}</span>
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{option.label}</h4>
                    <p className="text-xs text-slate-500">{option.description}</p>
                  </div>
                  {selectedPaymentMethod === option.id && (
                    <span className="material-symbols-outlined text-blue-600">check_circle</span>
                  )}
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 leading-5">
                Với <span className="font-bold text-slate-700 dark:text-slate-200">VNPay</span>, hệ thống sẽ chuyển bạn sang cổng thanh toán trước. Sau khi quay lại app, booking sẽ tiếp tục sang bước tìm tài xế.
              </div>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
    </div>
  );
};

export default CustomerRideOptionsPage;
