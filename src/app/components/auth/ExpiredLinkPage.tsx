import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pill, AlertTriangle, Mail, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';

interface ExpiredLinkPageProps {
  onBack: () => void;
}

export function ExpiredLinkPage({ onBack }: ExpiredLinkPageProps) {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }

    try {
      setIsSending(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            redirectTo: window.location.origin,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        const detail = result.details ? ` — ${result.details}` : '';
        throw new Error((result.error || 'Failed to send reset email') + detail);
      }

      setSent(true);
      toast.success('New reset link sent!', {
        description: 'Check your inbox for a fresh password reset link.',
        duration: 6000,
      });
    } catch (err: any) {
      console.error('Resend error:', err);
      toast.error('Error', { description: err.message || 'Failed to send reset email.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9867C5] via-[#9867C5]/90 to-[#9867C5] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center mb-4">
              <Pill className="w-10 h-10 text-[#9867C5]" />
            </div>
            <h1 className="text-3xl font-bold text-[#9867C5]">MediFlow</h1>
            <p className="text-gray-500 text-sm">Drug Inventory Management System</p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">New Link Sent!</h2>
              <p className="text-gray-500 text-sm mb-6">
                A fresh password reset link has been sent to <strong>{email}</strong>.<br />
                Please check your inbox and click the link promptly — it expires in <strong>1 hour</strong>.
              </p>
              <button
                onClick={onBack}
                className="text-[#9867C5] hover:text-[#9867C5]/80 text-sm font-medium transition-colors flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </motion.div>
          ) : (
            <>
              {/* Error banner */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Reset link expired</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    The password reset link you clicked has expired or has already been used.
                    Enter your email below to receive a fresh one.
                  </p>
                </div>
              </div>

              <form onSubmit={handleResend} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 ml-1">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9867C5] outline-none text-sm"
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSending || !email.trim()}
                  className="w-full py-3 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white font-semibold rounded-xl shadow-lg shadow-[#9867C5]/40 transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Send New Reset Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onBack}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
