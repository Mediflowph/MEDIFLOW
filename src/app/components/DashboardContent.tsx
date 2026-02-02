import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Package,
  Pill,
  Users,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

export function DashboardContent() {
  const stats = [
    {
      title: 'Total Medications',
      value: '1,247',
      change: '+12%',
      trend: 'up',
      icon: Pill,
      color: 'teal',
    },
    {
      title: 'Low Stock Items',
      value: '23',
      change: '-5%',
      trend: 'down',
      icon: AlertTriangle,
      color: 'yellow',
    },
    {
      title: 'Dispensed Today',
      value: '156',
      change: '+8%',
      trend: 'up',
      icon: Package,
      color: 'green',
    },
    {
      title: 'Active Orders',
      value: '42',
      change: '+3%',
      trend: 'up',
      icon: Activity,
      color: 'blue',
    },
  ];

  const alerts = [
    {
      id: 1,
      type: 'critical',
      medication: 'Amoxicillin 500mg',
      message: 'Critical low stock - 15 units remaining',
      time: '10 minutes ago',
    },
    {
      id: 2,
      type: 'warning',
      medication: 'Ibuprofen 200mg',
      message: 'Approaching expiry date - 45 days remaining',
      time: '1 hour ago',
    },
    {
      id: 3,
      type: 'info',
      medication: 'Metformin 850mg',
      message: 'Restock order received - 500 units',
      time: '3 hours ago',
    },
  ];

  const recentActivity = [
    { id: 1, action: 'Dispensed', medication: 'Lisinopril 10mg', quantity: 30, user: 'J. Smith', time: '2:45 PM' },
    { id: 2, action: 'Received', medication: 'Atorvastatin 20mg', quantity: 200, user: 'M. Davis', time: '1:30 PM' },
    { id: 3, action: 'Dispensed', medication: 'Omeprazole 40mg', quantity: 60, user: 'S. Johnson', time: '12:15 PM' },
    { id: 4, action: 'Adjusted', medication: 'Levothyroxine 50mcg', quantity: -5, user: 'A. Wilson', time: '11:00 AM' },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown;
          
          return (
            <Card key={stat.title} className="border-none shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-800 mb-2">{stat.value}</p>
                    <div className="flex items-center gap-1">
                      <TrendIcon 
                        className={`w-4 h-4 ${stat.trend === 'up' ? 'text-[#9867C5]' : 'text-red-600'}`} 
                      />
                      <span className={`text-sm ${stat.trend === 'up' ? 'text-[#9867C5]' : 'text-red-600'}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">vs last week</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    stat.color === 'teal' ? 'bg-[#9867C5]/10 text-[#9867C5]' :
                    stat.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                    stat.color === 'green' ? 'bg-[#9867C5]/10 text-[#9867C5]' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Panel */}
        <Card className="lg:col-span-2 border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.type === 'critical' ? 'bg-red-50 border-red-500' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-1">{alert.medication}</p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <button className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <Pill className="w-4 h-4" />
                <span className="text-sm">Dispense Medicine</span>
              </button>
              <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <Package className="w-4 h-4" />
                <span className="text-sm">Receive Stock</span>
              </button>
              <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Inventory Count</span>
              </button>
              <button className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Generate Report</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-slate-50">
          <CardTitle className="text-gray-800">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Action</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Medication</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Quantity</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">User</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr key={activity.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                        activity.action === 'Dispensed' ? 'bg-blue-100 text-blue-700' :
                        activity.action === 'Received' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {activity.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800">{activity.medication}</td>
                    <td className="py-3 px-4 text-sm text-gray-800">{activity.quantity}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{activity.user}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{activity.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
