const DEFAULT_PICKUP = {
  lat: 10.795,
  lng: 106.722,
  name: 'Landmark 81',
  address: 'Landmark 81',
};

const PICKUP_KEY = 'pickup';
const RECENT_DESTINATIONS_KEY = 'customerRecentDestinations';
const MAX_RECENT_DESTINATIONS = 5;

const isValidCoordinate = (value) => typeof value === 'number' && Number.isFinite(value);

const isValidLocation = (value) => value && isValidCoordinate(value.lat) && isValidCoordinate(value.lng);

const normalizeDestination = (place) => {
  if (!isValidLocation(place)) return null;

  const address = place.address || place.name || 'Điểm đến đã chọn';

  return {
    name: place.name || address,
    address,
    lat: place.lat,
    lng: place.lng,
    distance: place.distance || '',
  };
};

export const getStoredPickup = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PICKUP_KEY) || 'null');

    if (isValidLocation(parsed)) {
      return {
        ...DEFAULT_PICKUP,
        ...parsed,
        name: parsed.name || parsed.address || DEFAULT_PICKUP.name,
        address: parsed.address || parsed.name || DEFAULT_PICKUP.address,
      };
    }
  } catch {
    // Ignore malformed session data and fall back to a safe default.
  }

  return DEFAULT_PICKUP;
};

export const setStoredPickup = (pickup) => {
  const normalizedPickup = {
    ...DEFAULT_PICKUP,
    ...pickup,
    name: pickup?.name || pickup?.address || DEFAULT_PICKUP.name,
    address: pickup?.address || pickup?.name || DEFAULT_PICKUP.address,
  };

  sessionStorage.setItem(PICKUP_KEY, JSON.stringify(normalizedPickup));
  return normalizedPickup;
};

export const getRecentDestinations = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_DESTINATIONS_KEY) || '[]');

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeDestination)
      .filter(Boolean)
      .slice(0, MAX_RECENT_DESTINATIONS);
  } catch {
    return [];
  }
};

export const addRecentDestination = (place) => {
  const nextDestination = normalizeDestination(place);

  if (!nextDestination) {
    return getRecentDestinations();
  }

  const deduped = getRecentDestinations().filter((item) => (
    item.lat !== nextDestination.lat
    || item.lng !== nextDestination.lng
    || item.address !== nextDestination.address
  ));

  const nextRecentDestinations = [nextDestination, ...deduped].slice(0, MAX_RECENT_DESTINATIONS);
  localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(nextRecentDestinations));

  return nextRecentDestinations;
};

export const clearRecentDestinations = () => {
  localStorage.removeItem(RECENT_DESTINATIONS_KEY);
};

export { DEFAULT_PICKUP };