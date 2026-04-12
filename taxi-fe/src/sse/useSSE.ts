import { useEffect, useRef, useState } from "react";
import { ENV } from "../lib/env";
import { isExpired } from "../lib/jwt";

export type RealtimeEvent = {
  ts: number;
  eventName: string;
  data: any;
};

export function useSSE(token: string | null, enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!token || !enabled) return;

    let destroyed = false;

    function connect() {
      if (destroyed) return;
      // Don't reconnect with an expired token – wait for AuthContext to clear it
      if (isExpired(token!)) {
        console.warn("[SSE] token expired, not connecting");
        return;
      }

      const url = `${ENV.NOTIF_URL}/notifications/stream?token=${encodeURIComponent(token!)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("hello", (e: MessageEvent) => {
        retryCountRef.current = 0; // reset backoff on successful connect
        setConnected(true);
        setEvents((prev) => [{ ts: Date.now(), eventName: "hello", data: safeJson(e.data) }, ...prev]);
      });

      const handler = (name: string) => (e: MessageEvent) => {
        setEvents((prev) => [{ ts: Date.now(), eventName: name, data: safeJson(e.data) }, ...prev]);
      };

      // user events
      es.addEventListener("booking", handler("booking"));
      es.addEventListener("payment", handler("payment"));
      es.addEventListener("ride_accepted", handler("ride_accepted"));
      es.addEventListener("ride_completed", handler("ride_completed"));
      es.addEventListener("booking_cancelled", handler("booking_cancelled"));
      // driver events
      es.addEventListener("ride_offer", handler("ride_offer"));
      es.addEventListener("ride_offer_cancelled", handler("ride_offer_cancelled"));
      es.addEventListener("ride_cancelled", handler("ride_cancelled"));
      es.addEventListener("passenger_picked_up", handler("passenger_picked_up"));

      es.onerror = () => {
        if (destroyed) return;
        setConnected(false);
        es.close();
        esRef.current = null;

        // If token expired, stop retrying — AuthContext will clear the token
        if (isExpired(token!)) {
          console.warn("[SSE] token expired, stopping reconnect");
          return;
        }

        // Exponential backoff: 2s, 4s, 8s … max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current += 1;
        console.log(`[SSE] error — reconnecting in ${delay}ms (attempt ${retryCountRef.current})`);
        retryTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
      retryCountRef.current = 0;
      setConnected(false);
    };
  }, [token, enabled]);

  return { connected, events, clear: () => setEvents([]) };
}

function safeJson(s: any) {
  try {
    return JSON.parse(String(s));
  } catch {
    return s;
  }
}