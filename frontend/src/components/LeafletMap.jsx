import React, { useEffect, useRef } from 'react';

/**
 * LeafletMap - Bản đồ thực dùng Leaflet + Leaflet Routing Machine
 * - Nếu có routeLine (>= 2 điểm), dùng LRM để vẽ đường theo lộ trình thực tế
 * Props:
 *   center: [lat, lng]
 *   zoom: number
 *   markers: [{ lat, lng, label, color }]
 *   routeLine: [[lat, lng], [lat, lng]] - 2 điểm → vẽ đường thực qua OSRM
 *   className: CSS class
 *   onMapClick: fn(lat, lng)
 *   flyTo: [lat, lng]
 */
const LeafletMap = ({
  center = [10.7769, 106.7009],
  zoom = 14,
  markers = [],
  routeLine = [],
  className = '',
  style = {},
  onMapClick,
  flyTo,
}) => {
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null);
  const markerLayerRef = useRef(null);
  const routingRef  = useRef(null);   // Leaflet Routing Machine control
  const userMarkerRef = useRef(null);

  // ── Khởi tạo bản đồ một lần ────────────────────────────────────────
  useEffect(() => {
    const L = window.L;
    if (!L || leafletRef.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);

    if (onMapClick) {
      map.on('click', e => onMapClick(e.latlng.lat, e.latlng.lng));
    }

    leafletRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      if (routingRef.current) {
        try { routingRef.current.remove(); } catch {}
        routingRef.current = null;
      }
      map.remove();
      leafletRef.current   = null;
      markerLayerRef.current = null;
      userMarkerRef.current  = null;
    };
  }, []);

  // ── Cập nhật markers ────────────────────────────────────────────────
  useEffect(() => {
    const L = window.L;
    if (!L || !leafletRef.current || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();

    markers.forEach((m) => {
      const icon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;
          background:${m.color || '#3b82f6'};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.45);
        "></div>`,
        className: '',
        iconAnchor: [8, 8],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(markerLayerRef.current);

      if (m.label) {
        marker.bindTooltip(m.label, {
          permanent: true,
          direction: 'top',
          offset: [0, -14],
          className: 'bg-white text-slate-800 text-xs font-bold px-2 py-1 rounded shadow border border-slate-200',
        });
      }
    });
  }, [markers]);

  // ── Center/zoom khi không có route ─────────────────────────────────
  useEffect(() => {
    if (!leafletRef.current || routeLine.length >= 2) return;
    leafletRef.current.setView(center, zoom);
    requestAnimationFrame(() => leafletRef.current?.invalidateSize());
  }, [center, zoom, routeLine]);

  // ── Vẽ route theo đường thực bằng Leaflet Routing Machine ──────────
  useEffect(() => {
    const L = window.L;
    if (!L || !leafletRef.current) return;

    // Xoá routing cũ
    if (routingRef.current) {
      try { routingRef.current.remove(); } catch {}
      routingRef.current = null;
    }

    if (routeLine.length < 2) return;

    // Kiểm tra LRM đã load chưa
    if (!L.Routing) {
      console.warn('[LeafletMap] Leaflet Routing Machine chưa load, dùng đường thẳng');
      // Fallback: đường thẳng
      const poly = L.polyline(routeLine, {
        color: '#3b82f6', weight: 4, opacity: 0.6, dashArray: '10 8',
      }).addTo(leafletRef.current);
      routingRef.current = { remove: () => poly.remove() };
      leafletRef.current.fitBounds(poly.getBounds(), { padding: [70, 70] });
      return;
    }

    // Dùng LRM với OSRM router
    const waypoints = routeLine.map(p => L.latLng(p[0], p[1]));

    const control = L.Routing.control({
      waypoints,
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      // Ẩn toàn bộ UI chỉ giữ đường trên bản đồ
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [{ color: '#3b82f6', weight: 5, opacity: 0.9 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      // Ẩn panel chỉ dẫn
      createMarker: () => null,   // không tạo marker của LRM (ta đã có marker riêng)
    });

    control.on('routingerror', (e) => {
      console.warn('[LeafletMap] LRM routing error, thử server 2:', e.error?.message);
      // Thử server backup
      try {
        control.getRouter().options.serviceUrl =
          'https://routing.openstreetmap.de/routed-car/route/v1';
        control.route();
      } catch {}
    });

    control.addTo(leafletRef.current);
    routingRef.current = control;

    // Ẩn panel chỉ dẫn đường (itinerary) khỏi DOM sau khi render
    setTimeout(() => {
      const el = document.querySelector('.leaflet-routing-container');
      if (el) el.style.display = 'none';
    }, 500);

    return () => {
      if (routingRef.current) {
        try { routingRef.current.remove(); } catch {}
        routingRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(routeLine)]);

  // ── flyTo ───────────────────────────────────────────────────────────
  useEffect(() => {
    const L = window.L;
    if (!flyTo || !leafletRef.current || !L) return;
    const [lat, lng] = flyTo;

    leafletRef.current.flyTo([lat, lng], 16, { duration: 1 });

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const icon = L.divIcon({
      html: `<div style="
        width:18px;height:18px;
        background:#3b82f6;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 0 6px rgba(59,130,246,0.25);
      "></div>`,
      className: '',
      iconAnchor: [9, 9],
    });

    userMarkerRef.current = L.marker([lat, lng], { icon })
      .bindTooltip('Vị trí của bạn', { permanent: false, direction: 'top', offset: [0, -14] })
      .addTo(leafletRef.current);
  }, [flyTo]);

  return (
    <div
      ref={mapRef}
      className={className}
      style={{ position: 'relative', zIndex: 0, ...style }}
    />
  );
};

export default LeafletMap;
