import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState, useRef } from "react";

// Fix default marker icons for webpack/vite
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const pickupIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const dropoffIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const carIcon = L.divIcon({
  html: `<div style="width:40px;height:40px;background:#4F46E5;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(79,70,229,0.4);border:3px solid white;"><span style=\"font-size:20px\">🚗</span></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  className: '',
});

L.Marker.prototype.options.icon = defaultIcon;

type LatLng = { lat: number; lng: number };

type Props = {
  center?: LatLng;
  zoom?: number;
  pickup?: LatLng & { label?: string };
  dropoff?: LatLng & { label?: string };
  driver?: LatLng & { label?: string };
  routeFrom?: LatLng;
  routeTo?: LatLng;
  className?: string;
  height?: string;
};

function FitBounds({ pickup, dropoff, driver }: { pickup?: LatLng; dropoff?: LatLng; driver?: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const pts = [pickup, dropoff, driver].filter(Boolean) as LatLng[];
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
  }, [pickup, dropoff, driver, map]);
  return null;
}

function RouteLine({ from, to }: { from: LatLng; to: LatLng }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      { signal: ac.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]?.geometry?.coordinates) {
          setRoute(
            data.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            )
          );
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setRoute([[from.lat, from.lng], [to.lat, to.lng]]);
      });

    return () => ac.abort();
  }, [from.lat, from.lng, to.lat, to.lng]);

  if (!route.length) return null;
  return (
    <>
      <Polyline positions={route} color="#000" weight={6} opacity={0.1} />
      <Polyline positions={route} color="#4F46E5" weight={4} opacity={0.85} />
    </>
  );
}

export function MapView({
  center = { lat: 10.7769, lng: 106.7009 }, // HCM City default
  zoom = 13,
  pickup,
  dropoff,
  driver,
  routeFrom,
  routeTo,
  className = "",
  height = "100%",
}: Props) {
  const rf = routeFrom || pickup;
  const rt = routeTo || dropoff;
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="w-full h-full rounded-xl"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pickup={pickup} dropoff={dropoff} driver={driver} />

        {rf && rt && <RouteLine from={rf} to={rt} />}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>{pickup.label || "Pickup"}</Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>{dropoff.label || "Dropoff"}</Popup>
          </Marker>
        )}
        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={carIcon}>
            <Popup>{driver.label || "Driver"}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
