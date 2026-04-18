import { useEffect, useState } from 'react';

export function MaintenanceScreen() {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCount(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="maintenance-screen">
      {/* Animated background gradient */}
      <div className="maintenance-bg"></div>

      {/* Floating medical elements */}
      <div className="floating-elements">
        <div className="float-pill float-1"></div>
        <div className="float-pill float-2"></div>
        <div className="float-pill float-3"></div>
        <div className="float-cross float-4"></div>
        <div className="float-cross float-5"></div>
      </div>

      {/* Main content */}
      <div className="maintenance-content">
        {/* Heartbeat/Pulse indicator */}
        <div className="pulse-container">
          <div className="pulse-circle pulse-1"></div>
          <div className="pulse-circle pulse-2"></div>
          <div className="pulse-circle pulse-3"></div>
          <div className="pulse-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
        </div>

        {/* Text content */}
        <h1 className="maintenance-title">
          System Under Maintenance
        </h1>

        <p className="maintenance-subtitle">
          We're upgrading MediFlow to serve you better
        </p>

        <div className="maintenance-details">
          <div className="detail-card">
            <div className="detail-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="detail-text">
              <div className="detail-label">Estimated Time</div>
              <div className="detail-value">2-4 hours</div>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </div>
            <div className="detail-text">
              <div className="detail-label">What We're Doing</div>
              <div className="detail-value">System upgrades</div>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div className="detail-text">
              <div className="detail-label">Your Data</div>
              <div className="detail-value">Secure & safe</div>
            </div>
          </div>
        </div>

        <div className="maintenance-message">
          <p>
            All inventory data remains secure during this maintenance window.
            You'll be able to access the system shortly.
          </p>
        </div>

        {/* Animated progress indicator */}
        <div className="progress-container">
          <div className="progress-label">System Status</div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <div className="progress-text">Updating core services...</div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

        .maintenance-screen {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .maintenance-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            #0f172a 0%,
            #1e293b 25%,
            #334155 50%,
            #475569 75%,
            #64748b 100%
          );
          animation: gradientShift 15s ease infinite;
        }

        .maintenance-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
          animation: bgPulse 10s ease infinite;
        }

        @keyframes gradientShift {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          50% { filter: hue-rotate(10deg) brightness(1.1); }
        }

        @keyframes bgPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        .floating-elements {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .float-pill {
          position: absolute;
          width: 60px;
          height: 20px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
          border-radius: 50px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .float-cross {
          position: absolute;
          width: 40px;
          height: 40px;
          background:
            linear-gradient(0deg, rgba(16, 185, 129, 0.2) 0%, transparent 100%),
            linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, transparent 100%);
          backdrop-filter: blur(10px);
        }

        .float-cross::before,
        .float-cross::after {
          content: '';
          position: absolute;
          background: rgba(16, 185, 129, 0.3);
          border-radius: 2px;
        }

        .float-cross::before {
          width: 100%;
          height: 8px;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
        }

        .float-cross::after {
          width: 8px;
          height: 100%;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
        }

        .float-1 {
          top: 15%;
          left: 10%;
          animation: float 20s ease-in-out infinite;
        }

        .float-2 {
          top: 60%;
          left: 80%;
          animation: float 25s ease-in-out infinite 2s;
        }

        .float-3 {
          top: 80%;
          left: 20%;
          animation: float 18s ease-in-out infinite 4s;
        }

        .float-4 {
          top: 25%;
          right: 15%;
          animation: float 22s ease-in-out infinite 1s;
        }

        .float-5 {
          bottom: 20%;
          right: 25%;
          animation: float 28s ease-in-out infinite 3s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.4;
          }
          25% {
            transform: translate(30px, -30px) rotate(90deg);
            opacity: 0.6;
          }
          50% {
            transform: translate(-20px, 20px) rotate(180deg);
            opacity: 0.5;
          }
          75% {
            transform: translate(40px, 10px) rotate(270deg);
            opacity: 0.7;
          }
        }

        .maintenance-content {
          position: relative;
          z-index: 10;
          max-width: 600px;
          width: 90%;
          text-align: center;
          animation: contentFadeIn 1s ease-out;
        }

        @keyframes contentFadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pulse-container {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 40px;
        }

        .pulse-circle {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(16, 185, 129, 0.5);
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .pulse-1 {
          animation-delay: 0s;
        }

        .pulse-2 {
          animation-delay: 0.5s;
        }

        .pulse-3 {
          animation-delay: 1s;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          50% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }

        .pulse-center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(59, 130, 246, 0.3));
          border-radius: 50%;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #10b981;
          animation: centerPulse 2s ease-in-out infinite;
        }

        @keyframes centerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .maintenance-title {
          font-family: 'Outfit', sans-serif;
          font-size: 42px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 16px;
          letter-spacing: -0.02em;
          line-height: 1.2;
          animation: titleSlideIn 0.8s ease-out 0.2s both;
        }

        @keyframes titleSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .maintenance-subtitle {
          font-size: 18px;
          color: #94a3b8;
          margin: 0 0 48px;
          font-weight: 500;
          animation: titleSlideIn 0.8s ease-out 0.3s both;
        }

        .maintenance-details {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 40px;
          animation: titleSlideIn 0.8s ease-out 0.4s both;
        }

        .detail-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          transition: all 0.3s ease;
        }

        .detail-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .detail-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3));
          border-radius: 12px;
          color: #8b5cf6;
        }

        .detail-text {
          flex: 1;
          text-align: left;
        }

        .detail-label {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 4px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .detail-value {
          font-size: 16px;
          color: #e2e8f0;
          font-weight: 600;
        }

        .maintenance-message {
          padding: 24px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 16px;
          margin-bottom: 40px;
          animation: titleSlideIn 0.8s ease-out 0.5s both;
        }

        .maintenance-message p {
          margin: 0;
          color: #d1fae5;
          font-size: 15px;
          line-height: 1.6;
        }

        .progress-container {
          animation: titleSlideIn 0.8s ease-out 0.6s both;
        }

        .progress-label {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg,
            #8b5cf6 0%,
            #3b82f6 50%,
            #10b981 100%
          );
          background-size: 200% 100%;
          border-radius: 100px;
          animation: progressFlow 2s ease-in-out infinite;
          width: 65%;
        }

        @keyframes progressFlow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .progress-text {
          font-size: 14px;
          color: #cbd5e1;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .maintenance-title {
            font-size: 32px;
          }

          .maintenance-subtitle {
            font-size: 16px;
            margin-bottom: 32px;
          }

          .detail-card {
            padding: 16px 20px;
          }

          .detail-icon {
            width: 40px;
            height: 40px;
          }

          .pulse-container {
            width: 100px;
            height: 100px;
            margin-bottom: 32px;
          }
        }
      `}</style>
    </div>
  );
}
