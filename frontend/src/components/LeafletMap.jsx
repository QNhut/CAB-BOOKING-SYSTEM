import React, { useEffect, useRef, useState } from 'react';

/**
 * LeafletMap - Bản đồ thực dùng Leaflet (load từ CDN trong index.html)
 * - Nếu có routeLine, tự động gọi OSRM để vẽ đường theo lộ trình thực
 * Props:
 *   center: [lat, lng]
 *   zoom: number
 *   markers: [{ lat, lng, label, color }]
 *   routeLine: [[lat, lng], ...] - nếu có sẽ fetch route thực từ OSRM
 *   className: CSS class
 *   onMapClick: fn(lat, lng)
 */
const LeafletMap = ({ center = [10.7769, 106.7009], zoom = 14, markers = [], routeLine = [], className = '', style = {}, onMapClick, flyTo }) => {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const polylineRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markerLayerRef = useRef(null);

  // Fetch real road route từ OSRM public API
  const fetchOSRMRoute = async (waypoints) => {
    if (!waypoints || waypoints.length < 2) return null;
    try {
      // OSRM: tọa độ theo thứ tự lng,lat
      const coords = waypoints.map(p => `${p[1]},${p[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        // GeoJSON coordinates là [lng, lat], đổi sang [lat, lng] cho Leaflet
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      }
    } catch (e) {
      console.warn('OSRM route fetch failed, dùng đường thẳng:', e);
    }
    return null;
  };

  useEffect(() => {
    const L = window.L;
    if (!L || leafletRef.current) return;

    // Khởi tạo bản đồ
    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    // Tile layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    // Click handler
    if (onMapClick) {
      map.on('click', e => onMapClick(e.latlng.lat, e.latlng.lng));
    }

    leafletRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      leafletRef.current = null;
      polylineRef.current = null;
      userMarkerRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || !leafletRef.current || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();

    markers.forEach((markerData) => {
      const icon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;
          background:${markerData.color || '#3b82f6'};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
        "></div>`,
        className: '',
        iconAnchor: [7, 7],
      });

      const marker = L.marker([markerData.lat, markerData.lng], { icon }).addTo(markerLayerRef.current);

      if (markerData.label) {
        marker.bindTooltip(markerData.label, {
          permanent: true,
          direction: 'top',
          offset: [0, -12],
          className: 'bg-white text-slate-800 text-xs font-bold px-2 py-1 rounded shadow border border-slate-200'
        });
      }
    });
  }, [markers]);

  useEffect(() => {
    if (!leafletRef.current || routeLine.length >= 2) return;

    leafletRef.current.setView(center, zoom);
    requestAnimationFrame(() => leafletRef.current?.invalidateSize());
  }, [center, zoom, routeLine]);

  useEffect(() => {
    const L = window.L;
    if (!L || !leafletRef.current) return;

    let isCancelled = false;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (routeLine.length < 2) {
      return undefined;
    }

    const fallbackPolyline = L.polyline(routeLine, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.6,
      dashArray: '8 5'
    }).addTo(leafletRef.current);

    polylineRef.current = fallbackPolyline;
    leafletRef.current.fitBounds(fallbackPolyline.getBounds(), { padding: [60, 60] });

    fetchOSRMRoute(routeLine).then((realRoute) => {
      if (isCancelled || !realRoute || realRoute.length < 2 || !leafletRef.current) {
        return;
      }

      if (polylineRef.current) {
        polylineRef.current.remove();
      }

      const realPolyline = L.polyline(realRoute, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.85,
      }).addTo(leafletRef.current);

      polylineRef.current = realPolyline;
      leafletRef.current.fitBounds(realPolyline.getBounds(), { padding: [60, 60] });
    });

    return () => {
      isCancelled = true;
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    };
  }, [routeLine]);

  // Pan/fly đến vị trí mới khi flyTo thay đổi
  useEffect(() => {
    const L = window.L;
    if (!flyTo || !leafletRef.current || !L) return;
    const [lat, lng] = flyTo;

    leafletRef.current.flyTo([lat, lng], 16, { duration: 1 });

    // Xóa marker vị trí cũ nếu có
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Vẽ marker vị trí hiện tại
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

  return <div ref={mapRef} className={className} style={{ position: 'relative', zIndex: 0, ...style }} />;
};

export default LeafletMap;
