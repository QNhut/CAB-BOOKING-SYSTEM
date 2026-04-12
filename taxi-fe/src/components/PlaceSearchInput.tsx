import { useEffect, useMemo, useState } from "react";
import { geoAutocomplete, geoPlace } from "../api/geo";
import type { GeoSuggestion } from "../api/geo";

type Value = { label: string; lat: number; lng: number };

export function PlaceSearchInput({
  label,
  value,
  onChange,
  biasLatLng,
}: {
  label: string;
  value: Value | null;
  onChange: (v: Value | null) => void;
  biasLatLng?: { lat: number; lng: number } | null;
}) {
  const [text, setText] = useState(value?.label || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setText(value?.label || "");
  }, [value?.label]);

  const q = useMemo(() => text.trim(), [text]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await geoAutocomplete({
          q,
          lat: biasLatLng?.lat,
          lng: biasLatLng?.lng,
          limit: 8,
        });
        setItems(resp.suggestions || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, biasLatLng?.lat, biasLatLng?.lng]);

  async function selectItem(it: GeoSuggestion) {
    setOpen(false);
    setLoading(true);
    try {
      // ưu tiên location nếu autocomplete trả luôn
      if (it.location?.lat != null && it.location?.lng != null) {
        onChange({ label: it.text, lat: it.location.lat, lng: it.location.lng });
        setText(it.text);
        return;
      }
      const details = await geoPlace(it.placeId);
      if (!details.location) throw new Error("No location");
      const label = details.formattedAddress || details.name || it.text;
      onChange({ label, lat: details.location.lat, lng: details.location.lng });
      setText(label);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {label && <div className="font-semibold text-sm text-gray-700 mb-1.5">{label}</div>}
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search location..."
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-colors bg-white"
      />
      {loading && <div className="text-xs text-gray-400 mt-1">Loading…</div>}

      {open && items.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-auto">
          {items.map((it) => (
            <div
              key={it.placeId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(it)}
              className="px-4 py-3 cursor-pointer hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="font-medium text-sm text-gray-800">{it.text}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {it.distanceMeters != null ? `${it.distanceMeters}m` : ""} {it.types?.[0] ? `• ${it.types[0]}` : ""}
              </div>
            </div>
          ))}
          <div className="px-4 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50 text-center" onClick={() => setOpen(false)}>
            Close
          </div>
        </div>
      )}
    </div>
  );
}