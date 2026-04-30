import React, { useState, useCallback } from 'react';
import { addRecentDestination, getRecentDestinations, getStoredPickup, setStoredPickup } from '../../lib/customerStorage';

const formatDistance = (distanceMeters) => {
  if (typeof distanceMeters !== 'number') return '';
  if (distanceMeters < 1000) return `${distanceMeters} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

const CustomerDestinationPage = () => {
  const [pickup] = useState(() => getStoredPickup());
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [historySuggestions, setHistorySuggestions] = useState(() => getRecentDestinations());
  const [loading, setLoading] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);

  // Gọi Geo Autocomplete service thực
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/geo/autocomplete?q=${encodeURIComponent(q)}&lat=${pickup.lat}&lng=${pickup.lng}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Geo service error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    // Debounce 400ms
    clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => fetchSuggestions(q), 400));
  };

  const handleSelectPlace = (place) => {
    const destination = {
      name: place.text,
      address: place.text,
      lat: place.location?.lat || 10.7769,
      lng: place.location?.lng || 106.7009,
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
    setHistorySuggestions(addRecentDestination(destination));
    window.navigateTo('/customer/options');
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      <div className="p-4 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => window.navigateTo('/customer/home')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-bold text-lg">Chọn hành trình</h1>
        </div>

        <div className="relative flex flex-col gap-3 pl-4">
          <div className="absolute left-6 top-3 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <span className="material-symbols-outlined text-blue-500 text-[20px] bg-white dark:bg-slate-900 mt-1" style={{fontVariationSettings: "'FILL' 1"}}>my_location</span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold truncate text-blue-600">{pickup.address || pickup.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative z-10">
            <span className="material-symbols-outlined text-rose-500 text-[20px] bg-white dark:bg-slate-900 mt-1" style={{fontVariationSettings: "'FILL' 1"}}>location_on</span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center border border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <input 
                type="text" 
                autoFocus
                placeholder="Nhập điểm đến..." 
                className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-slate-500"
                value={searchQuery}
                onChange={handleInput}
              />
              {loading && <span className="text-slate-400 text-xs animate-pulse">...</span>}
              {searchQuery && !loading && (
                <button onClick={() => { setSearchQuery(''); setSuggestions([]); }} className="text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-2">
        {/* Kết quả từ Geo Service */}
        {suggestions.length > 0 && (
          <>
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest my-3 px-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">travel_explore</span>
              Gợi ý địa điểm
            </h3>
            <div className="space-y-1">
              {suggestions.map((place, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleSelectPlace(place)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">location_on</span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{place.text}</p>
                    {place.location && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {place.location.lat.toFixed(4)}, {place.location.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Lịch sử / gợi ý mặc định */}
        {suggestions.length === 0 && (
          <>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest my-3 px-2">Lịch sử tìm kiếm</h3>
            {historySuggestions.length > 0 ? (
              <div className="space-y-1">
                {historySuggestions.map((place, idx) => (
                  <div 
                    key={`${place.lat}-${place.lng}-${idx}`}
                    onClick={() => handleSelectHistory(place)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0"
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
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
