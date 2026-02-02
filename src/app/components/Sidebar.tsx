import { 
  Home, 
  PackagePlus, 
  Pill, 
  Package, 
  ClipboardCheck, 
  FileText, 
  Bell,
  Building,
  User,
  Edit3,
  Shield,
  MapPin,
  Search
} from 'lucide-react';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  userRole?: string;
}

const getMenuItems = (userRole: string) => {
  const baseItems = [];

  // Add Admin Dashboard for Administrator only
  if (userRole === 'Administrator') {
    baseItems.push(
      { id: 'admin-dashboard', label: 'Admin Dashboard', icon: Shield }
    );
  }

  // Add Branch Management for Administrator and Health Officer
  if (userRole === 'Administrator' || userRole === 'Health Officer') {
    baseItems.push(
      { id: 'branch-management', label: 'Branch Inventory', icon: Building }
    );
  }

  // Common items for all roles
  baseItems.push(
    { id: 'home', label: 'Home', icon: Home }
  );

  // Add role-specific operational tabs
  if (userRole === 'Administrator' || userRole === 'Health Officer') {
    // Admin and HO don't need receive/dispense - they monitor branches
    baseItems.push(
      { id: 'stock', label: 'Stock Overview', icon: Package },
      { id: 'reports', label: 'Make Report', icon: FileText },
      { id: 'alerts', label: 'Alerts & Notifications', icon: Bell }
    );
  } else {
    // Staff get full operational tabs - REORDERED
    baseItems.push(
      { id: 'dispense', label: 'Dispense Drugs', icon: Pill },
      { id: 'receive', label: 'Receive Medications', icon: PackagePlus },
      { id: 'stock', label: 'Stock on Hand', icon: Package },
      { id: 'stock-locator', label: 'Stock Locator', icon: Search },
      { id: 'inventory', label: 'Inventory Check', icon: ClipboardCheck },
      { id: 'reports', label: 'Make Report', icon: FileText },
      { id: 'alerts', label: 'Alerts & Notifications', icon: Bell }
    );
  }

  // Add Profile/Branch Profile Settings for all
  if (userRole === 'Administrator') {
    baseItems.push({ id: 'profile', label: 'Branch Profile', icon: User });
  } else {
    baseItems.push({ id: 'profile', label: 'Profile Settings', icon: User });
  }

  return baseItems;
};

export function Sidebar({ activeItem, onItemClick, userRole = 'Pharmacy Staff' }: SidebarProps) {
  const menuItems = getMenuItems(userRole);
  
  return (
    <aside className="w-64 bg-gradient-to-b from-[#9867C5] via-blue-600 to-blue-700 min-h-screen p-6 flex flex-col">
      {/* Logo/Brand */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-[#9867C5]/60 rounded-lg flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">MediFlow</h1>
            <p className="text-xs text-purple-100">Inventory System</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#9867C5] shadow-lg'
                  : 'text-purple-50 hover:bg-[#9867C5]/80 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="mt-auto pt-6 border-t border-purple-300/40">
        <p className="text-xs text-purple-100 text-center">
          v1.0.0 • Hospital Edition
        </p>
      </div>
    </aside>
  );
}