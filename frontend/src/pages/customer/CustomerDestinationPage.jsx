import React, { useState, useCallback } from 'react';
import { addRecentDestination, getRecentDestinations, getStoredPickup, setStoredPickup } from '../../lib/customerStorage';

const formatDistance = (distanceMeters) => {
  if (typeof distanceMeters !== 'number') return '';
  if (distanceMeters < 1000) return `${distanceMeters} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

// ─── Shared autocomplete hook ─────────────────────────────────────────────────
function useGeoSearch(biasLat, biasLng) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(null);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/geo/autocomplete?q=${encodeURIComponent(q)}&lat=${biasLat}&lng=${biasLng}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.suggestions || []);
      }
    } catch (e) {
      console.error('Geo service error:', e);
    } finally {
      setLoading(false);
    }
  }, [biasLat, biasLng]);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer);
    setTimer(setTimeout(() => search(q), 400));
  };

  const clear = () => { setQuery(''); setResults([]); };

  return { query, results, loading, handleInput, clear };
}

// ─── Main page ────────────────────────────────────────────────────────────────
const CustomerDestinationPage = () => {
  const [pickup, setPickup] = useState(() => getStoredPickup());
  // 'destination' | 'pickup'
  const [activeField, setActiveField] = useState('destination');
  const [historySuggestions, setHistorySuggestions] = useState(() => getRecentDestinations());
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const geoSearch = useGeoSearch(pickup.lat, pickup.lng);

  // ── Pickup selection ──────────────────────────────────────────────────────
  const handleSelectPickup = (place) => {
    const newPickup = {
      name: place.text,
      address: place.text,
      lat: place.location?.lat || pickup.lat,
      lng: place.location?.lng || pickup.lng,
    };
    setPickup(newPickup);
    setStoredPickup(newPickup);
    geoSearch.clear();
    setActiveField('destination');
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let newPickup = { lat: latitude, lng: longitude, name: 'Vị trí của bạn', address: 'Vị trí của bạn' };
        try {
          const res = await fetch(`/geo/reverse?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const label = data.formattedAddress || data.name || data.address || newPickup.address;
            newPickup = { ...newPickup, name: label, address: label };
          }
        } catch (e) {
          console.warn('Reverse geocode error:', e);
        }
        setPickup(newPickup);
        setStoredPickup(newPickup);
        geoSearch.clear();
        setActiveField('destination');
        setLocating(false);
      },
      () => {
        setLocError('Không lấy được vị trí. Vui lòng cấp quyền định vị.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Destination selection ─────────────────────────────────────────────────
  const handleSelectDestination = (place) => {
    const destination = {
      name: place.text || place.name,
      address: place.text || place.address,
      lat: place.location?.lat || place.lat,
      lng: place.location?.lng || place.lng,
      distance: formatDistance(place.distanceMeters),
    };
    sessionStorage.setItem('dropoff', JSON.stringify(destination));
    setStoredPickup(pickup);
    setHistorySuggestions(addRecentDestination(destination));
    window.navigateTo('/customer/options');
  };

  const handleSelectHistory = (place) => {
    const destination = {
      name: place.name,
      address: place.address || place.name,
      lat: place.lat,
      lng: place.lng,
      distance: place.distance || '',
    };
    sessionStorage.setItem('dropoff', JSON.stringify(destination));
    setStoredPickup(pickup);
    window.navigateTo('/customer/options');
  };

  const isPickupMode = activeField === 'pickup';

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      {/* ── Header with route inputs ─────────────────────────────────── */}
      <div className="p-4 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => window.navigateTo('/customer/home')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-bold text-lg">Chọn hành trình</h1>
        </div>

        <div className="relative flex flex-col gap-2.5 pl-4">
          {/* Vertical connector line */}
          <div className="absolute left-6 top-4 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* ── Pickup row ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 relative z-10">
            <span
              className="material-symbols-outlined text-blue-500 text-[20px] bg-white dark:bg-slate-900 shrink-0 cursor-pointer"
              style={{ fontVariationSettings: "'FILL' 1" }}
              onClick={() => { setActiveField('pickup'); geoSearch.clear(); }}
            >
              my_location
            </span>

            {isPickupMode ? (
              /* Editable pickup input */
              <div className="flex-1 flex items-center bg-blue-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-blue-400 gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Tìm điểm đón..."
                  className="flex-1 bg-transparent outline-none text-sm font-semibold text-blue-700 dark:text-blue-300 placeholder:text-blue-400"
                  value={geoSearch.query}
                  onChange={geoSearch.handleInput}
                />
                {geoSearch.loading && (
                  <span className="text-slate-400 text-xs animate-pulse shrink-0">...</span>
                )}
                {/* Get current location button */}
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  className="text-blue-500 hover:text-blue-700 disabled:opacity-50 shrink-0"
                  title="Lấy vị trí hiện tại"
                >
                  <span className={`material-symbols-outlined text-[20px] ${locating ? 'animate-spin' : ''}`}>
                    {locating ? 'autorenew' : 'gps_fixed'}
                  </span>
                </button>
                {/* Cancel edit */}
                <button
                  type="button"
                  onClick={() => { setActiveField('destination'); geoSearch.clear(); }}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : (
              /* Read-only pickup display — tap to edit */
              <button
                type="button"
                onClick={() => { setActiveField('pickup'); geoSearch.clear(); }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <p className="text-sm font-semibold truncate text-blue-600">
                  {pickup.address || pickup.name || 'Chọn điểm đón...'}
                </p>
              </button>
            )}
          </div>

          {locError && (
            <p className="ml-9 text-xs text-red-500">{locError}</p>
          )}

          {/* ── Destination row ─────────────────────────────────────────── */}
          <div className="flex items-center gap-3 relative z-10">
            <span
              className="material-symbols-outlined text-rose-500 text-[20px] bg-white dark:bg-slate-900 shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              location_on
            </span>
            <div className={`flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-2 transition-all ${!isPickupMode ? 'border border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20' : 'opacity-50'}`}>
              <input
                type="text"
                autoFocus={!isPickupMode}
                disabled={isPickupMode}
                placeholder="Nhập điểm đến..."
                className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-slate-500 disabled:cursor-default"
                value={!isPickupMode ? geoSearch.query : ''}
                onChange={!isPickupMode ? geoSearch.handleInput : undefined}
                onFocus={() => setActiveField('destination')}
              />
              {!isPickupMode && geoSearch.loading && (
                <span className="text-slate-400 text-xs animate-pulse shrink-0">...</span>
              )}
              {!isPickupMode && geoSearch.query && !geoSearch.loading && (
                <button onClick={geoSearch.clear} className="text-slate-400 shrink-0">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Suggestions list ──────────────────────────────────────────── */}
      <div className="flex-grow overflow-y-auto">
        {/* GPS shortcut when editing pickup */}
        {isPickupMode && !geoSearch.query && (
          <button
            onClick={handleGetCurrentLocation}
            disabled={locating}
            className="w-full flex items-center gap-4 px-6 py-4 text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <span className={`material-symbols-outlined text-[20px] ${locating ? 'animate-spin' : ''}`}>
                {locating ? 'autorenew' : 'gps_fixed'}
              </span>
            </div>
            <span className="text-sm">{locating ? 'Đang lấy vị trí...' : 'Sử dụng vị trí hiện tại'}</span>
          </button>
        )}

        {/* Autocomplete results */}
        {geoSearch.results.length > 0 && (
          <>
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest px-5 pt-4 pb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">travel_explore</span>
              Gợi ý địa điểm
            </h3>
            <div>
              {geoSearch.results.map((place, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => isPickupMode ? handleSelectPickup(place) : handleSelectDestination(place)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      {isPickupMode ? 'my_location' : 'location_on'}
                    </span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{place.text}</p>
                    {place.location && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {place.location.lat.toFixed(4)}, {place.location.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* History — only for destination mode, no query */}
        {!isPickupMode && !geoSearch.query && (
          <>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-5 pt-4 pb-2">
              Lịch sử tìm kiếm
            </h3>
            {historySuggestions.length > 0 ? (
              <div>
                {historySuggestions.map((place, idx) => (
                  <button
                    key={`${place.lat}-${place.lng}-${idx}`}
                    type="button"
                    onClick={() => handleSelectHistory(place)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <span className="material-symbols-outlined text-[20px]">history</span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{place.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{place.address}</p>
                    </div>
                    {place.distance && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md shrink-0 whitespace-nowrap">
                        {place.distance}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Chưa có lịch sử tìm kiếm gần đây.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerDestinationPage;
