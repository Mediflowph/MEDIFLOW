export function MaintenanceScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div 
          className="bg-white rounded-3xl p-8 text-center"
          style={{
            boxShadow: '12px 12px 24px rgba(0, 0, 0, 0.1), -12px -12px 24px rgba(255, 255, 255, 0.9)',
          }}
        >
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div 
              className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center"
              style={{
                boxShadow: '8px 8px 16px rgba(0, 0, 0, 0.1), -8px -8px 16px rgba(255, 255, 255, 0.9)',
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007AFF" 
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-12 h-12"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
          </div>

          {/* Logo */}
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#007AFF] to-[#34C759] bg-clip-text text-transparent">
            FiresecretFox
          </h1>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">
            Under Maintenance
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            We're currently upgrading our system to serve you better. 
            FiresecreFox will be back online shortly!
          </p>

          {/* Status indicators */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <span className="text-sm text-gray-600">Database Migration</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse"></div>
                <span className="text-xs text-gray-500">In Progress</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <span className="text-sm text-gray-600">Server Updates</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse"></div>
                <span className="text-xs text-gray-500">In Progress</span>
              </div>
            </div>
          </div>

          {/* Estimated time */}
          <div 
            className="bg-gradient-to-r from-[#007AFF]/10 to-[#34C759]/10 rounded-2xl p-4 mb-6"
            style={{
              boxShadow: 'inset 4px 4px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            <p className="text-sm text-gray-600 mb-1">Estimated completion</p>
            <p className="text-lg font-semibold text-[#007AFF]">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 inline-block mr-1"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Shortly
            </p>
          </div>

          {/* Footer message */}
          <p className="text-xs text-gray-500">
            Thank you for your patience! 
            <br />
            Follow us for updates or try again in a few minutes.
          </p>
        </div>

        {/* TSU Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#007AFF]"></div>
            <span className="text-sm text-gray-600 font-medium">wait nyo lang akooooooo, iiyak na ako dito</span>
          </div>
        </div>
      </div>
    </div>
  );
}
