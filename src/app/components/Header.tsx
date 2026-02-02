import { LogOut, User, Cloud, CloudOff, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';

interface HeaderProps {
  onLogout: () => void;
  userRole: string;
  userName?: string;
  profilePicture?: string;
  isSyncing?: boolean;
  lastSyncTime?: Date | null;
}

export function Header({ onLogout, userRole, userName = 'User', profilePicture, isSyncing = false, lastSyncTime }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatSyncTime = (time: Date | null) => {
    if (!time) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
      {/* Date Display */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-sm text-gray-500">Today's Date</p>
          <p className="text-lg font-semibold text-gray-800">{currentDate}</p>
        </div>
        
        {/* Live Sync Status */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
          {isSyncing ? (
            <>
              <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />
              <div className="text-xs">
                <p className="text-gray-700 font-medium">Syncing...</p>
                <p className="text-gray-500">Saving changes</p>
              </div>
            </>
          ) : lastSyncTime ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#9867C5]" />
              <div className="text-xs">
                <p className="text-gray-700 font-medium">Cloud Synced</p>
                <p className="text-gray-500">{formatSyncTime(lastSyncTime)}</p>
              </div>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4 text-gray-400" />
              <div className="text-xs">
                <p className="text-gray-700 font-medium">Not Synced</p>
                <p className="text-gray-500">Waiting for data</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-[#9867C5]">
            <AvatarImage src={profilePicture} alt="User" />
            <AvatarFallback className="bg-[#9867C5]/10 text-[#9867C5]">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="text-right">
            <p className="font-semibold text-gray-800">{userName}</p>
            <p className="text-xs text-gray-500">{userRole || 'User'}</p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="ml-4 flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </header>
  );
}