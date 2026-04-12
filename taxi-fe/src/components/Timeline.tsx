import type { RealtimeEvent } from "../sse/useSSE";

export function Timeline({ events }: { events: RealtimeEvent[] }) {
  return (
    <div className="space-y-1">
      {events.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📡</div>
          <p className="text-sm">No events yet</p>
        </div>
      )}
      {events.map((e, idx) => (
        <div key={idx} className="group rounded-lg p-2.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{e.eventName}</span>
            <span className="text-[10px] text-gray-400 font-mono">{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
          <pre className="text-[11px] text-gray-500 whitespace-pre-wrap break-all font-mono leading-relaxed bg-gray-50 rounded-md p-2 group-hover:bg-white transition-colors">
            {JSON.stringify(e.data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}