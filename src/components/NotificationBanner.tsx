import React, { useEffect } from 'react';
import { Bell, X, ArrowUpRight } from 'lucide-react';

export interface ActiveNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
}

interface NotificationBannerProps {
  notifications: ActiveNotification[];
  onDismiss: (id: string) => void;
  onNavigateToStock?: (ticker: string) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notifications,
  onDismiss,
  onNavigateToStock,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto p-4 rounded-xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md text-xs space-y-1.5 animate-slide-in"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 font-mono">
              <Bell className="w-3.5 h-3.5 animate-bounce" />
              <span>{n.title}</span>
            </div>
            <button
              onClick={() => onDismiss(n.id)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-200 font-sans leading-relaxed">
            {n.body}
          </p>
          <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1">
            <span>{n.timestamp}</span>
            <span className="text-emerald-400">Push Notificação Ativa</span>
          </div>
        </div>
      ))}
    </div>
  );
};
