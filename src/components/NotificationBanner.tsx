import React, { useEffect } from 'react';
import { Bell, X } from 'lucide-react';

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

const SingleNotificationCard: React.FC<{
  notification: ActiveNotification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  useEffect(() => {
    // Automatically close the notification after 5 seconds (5000ms)
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div
      className="pointer-events-auto p-4 rounded-xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md text-xs space-y-1.5 animate-slide-in relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-emerald-400 font-mono">
          <Bell className="w-3.5 h-3.5 animate-bounce" />
          <span>{notification.title}</span>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          className="text-slate-400 hover:text-white p-0.5 cursor-pointer transition-colors"
          title="Fechar agora"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-slate-200 font-sans leading-relaxed">
        {notification.body}
      </p>

      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1">
        <span>{notification.timestamp}</span>
        <span className="text-emerald-400 font-semibold">Fecha em 5s</span>
      </div>

      {/* 5-second countdown progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-400"
          style={{
            animation: 'shrinkWidth 5s linear forwards',
          }}
        />
      </div>
    </div>
  );
};

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => (
        <SingleNotificationCard
          key={n.id}
          notification={n}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
