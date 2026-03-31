import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Pill, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/app/utils/supabase';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';

interface ResetPasswordPageProps {
  onPasswordReset: () => void;
  /** Custom KV token from ?reset_token= query param. When present, uses our
   *  own /reset-password endpoint instead of supabase.auth.updateUser(). */
  token?: string;
}

export function ResetPasswordPage({ onPasswordReset, token }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][passwordStrength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);

      if (token) {
        // ── Custom token path: call our own /reset-password endpoint ─────────
        // This completely bypasses Supabase OTP and its expiry settings.
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/reset-password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ token, password }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to reset password');
        }
      } else {
        // ── Supabase session path (PASSWORD_RECOVERY event flow) ─────────────
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
      }

      setIsSuccess(true);
      toast.success('Password Updated', {
        description: 'Your password has been changed successfully. You can now sign in.',
        duration: 5000,
      });

      setTimeout(async () => {
        if (!token) {
          await supabase.auth.signOut();
        }
        onPasswordReset();
      }, 2500);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
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

          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Password Updated!</h2>
              <p className="text-gray-600 text-sm">
                Your password has been changed successfully.
                <br />
                Redirecting you to the sign-in page…
              </p>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-5 h-5 text-[#9867C5]" />
                  <h2 className="text-xl font-bold text-gray-800">Set New Password</h2>
                </div>
                <p className="text-sm text-gray-500 ml-7">
                  Choose a strong password for your MediFlow account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 ml-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9867C5] outline-none"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              i <= passwordStrength ? strengthColor : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ml-1 ${
                        passwordStrength <= 1 ? 'text-red-500' :
                        passwordStrength === 2 ? 'text-yellow-600' :
                        passwordStrength === 3 ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {strengthLabel} password
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#9867C5] outline-none ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-300'
                          : 'border-gray-200'
                      }`}
                      placeholder="Re-enter your new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 ml-1">Passwords do not match</p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !password || !confirmPassword}
                  className="w-full py-3 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white font-semibold rounded-xl shadow-lg shadow-[#9867C5]/40 transition-all transform active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Update Password
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onPasswordReset}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors mt-1"
                >
                  Cancel — return to Sign In
                </button>
              </form>
            </>
          )}
        </div>

        <div className="bg-[#fff9c4] px-8 py-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-[#f57f17] uppercase tracking-wider">
            Official DOH Inventory Portal
          </span>
        </div>
      </motion.div>
    </div>
  );
}
