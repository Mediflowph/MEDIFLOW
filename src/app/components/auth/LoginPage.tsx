import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Pill, Lock, Mail, User, AlertCircle, UserPlus, ArrowRight, Building, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/app/utils/supabase';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

/**
 * PRE-CREATED ADMIN ACCOUNTS:
 * 
 * 1. ADMINISTRATOR:
 *    Name: Mediflow ADMIN
 *    Email: mediflowa@gmail.com
 *    Password: MediflowADMIN01
 * 
 * 2. HEALTH OFFICER:
 *    Name: Mediflow HO
 *    Email: mediflowho@gmail.com
 *    Password: MediflowHO01!
 * 
 * Note: These accounts must be manually created via Supabase Admin Panel
 * with the appropriate role in user_metadata.
 */

interface LoginPageProps {
  onLogin: (session: any, branch: { id: string; name: string }) => void;
}

interface Branch {
  id: string;
  name: string;
  inventoryCount?: number;
  hasInventory?: boolean;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [isLogin, setIsInLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Pharmacy Staff');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Load branches with inventory status
    const loadBranches = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (!response.ok) {
          console.error('Failed to fetch branches - HTTP error:', response.status);
          throw new Error('Failed to fetch branches');
        }

        const result = await response.json();
        console.log('✅ Branches API response:', result);
        
        // Backend returns array directly, not wrapped in object
        const branchesData = Array.isArray(result) ? result : (result.branches || []);
        console.log('📍 Loaded branches:', branchesData);
        setBranches(branchesData);
      } catch (err) {
        console.error('❌ Failed to load branches:', err);
        toast.error('Failed to load branches', {
          description: 'Could not fetch branch list. Please refresh the page.'
        });
      }
    };
    loadBranches();
  }, []);

  const handleInitAdminAccounts = async () => {
    try {
      setIsInitializing(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/init-admin-accounts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize admin accounts');
      }

      const created = result.results.filter((r: any) => r.status === 'created').length;
      const existing = result.results.filter((r: any) => r.status === 'already_exists').length;
      
      if (created > 0) {
        toast.success('Admin Accounts Created!', { 
          description: `${created} account(s) created successfully. You can now sign in.` 
        });
      } else if (existing > 0) {
        toast.info('Admin Accounts Exist', { 
          description: 'Admin accounts already exist. You can sign in now.' 
        });
      }
    } catch (err: any) {
      console.error('Init admin error:', err);
      toast.error('Initialization Failed', { 
        description: err.message || 'Could not create admin accounts' 
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Sign In first to check user role
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          // Check if it's an invalid credentials error that might be due to pending approval
          if (authError.message.includes('Invalid') || authError.message.includes('invalid')) {
            setError('Invalid email or password. If you recently registered, your account may still be pending approval.');
          } else {
            throw authError;
          }
          setIsLoading(false);
          return;
        }
        
        console.log('🔍 Login successful, checking approval status...');
        console.log('User metadata:', data.user?.user_metadata);
        
        // Check if user is approved (for Pharmacy Staff)
        const userMetadata = data.user?.user_metadata;
        const userRole = userMetadata?.role || '';
        const isApproved = userMetadata?.approved;
        
        console.log('Role:', userRole);
        console.log('Approved status:', isApproved);
        
        // Check if branch selection is required (not for Admins and Health Officers)
        const requiresBranch = userRole !== 'Administrator' && userRole !== 'Health Officer';
        
        if (requiresBranch && !selectedBranchId) {
          setError('Please select a branch to login.');
          setIsLoading(false);
          await supabase.auth.signOut();
          return;
        }
        
        // Staff accounts must be approved
        if (userRole === 'Pharmacy Staff' && isApproved === false) {
          // User is not approved yet
          console.log('⛔ User not approved, blocking access');
          await supabase.auth.signOut();
          toast.error('Account Pending Approval', {
            description: 'Your account has been created but is awaiting administrator approval. Please contact your system administrator.',
            duration: 6000
          });
          setError('Your account is pending administrator approval. You will receive access once approved.');
          setIsLoading(false);
          return;
        }
        
        console.log('✅ User approved, proceeding with login');
        
        // For admins and health officers, use a special "All Branches" designation
        const selectedBranch = requiresBranch 
          ? (branches.find(b => b.id === selectedBranchId) || { id: selectedBranchId, name: 'Unknown' })
          : { id: 'all', name: 'All Branches' };
        
        // Assign user to branch in database (if branch is selected)
        if (requiresBranch && selectedBranchId) {
          try {
            const assignResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/assign-user-branch`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Token': data.session.access_token,
                  'Authorization': `Bearer ${publicAnonKey}`
                },
                body: JSON.stringify({ branchId: selectedBranchId })
              }
            );
            
            if (!assignResponse.ok) {
              console.error('Failed to assign branch to user');
            } else {
              console.log('✅ Branch assigned successfully');
            }
          } catch (err) {
            console.error('Error assigning branch:', err);
          }
        }
        
        onLogin(data.session, selectedBranch);
      } else {
        // Sign Up via Edge Function
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ 
            email, 
            password, 
            name, 
            role, 
            branch: 'Pending Branch Assignment'
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Signup failed');

        // Check if account requires approval
        if (result.requiresApproval) {
          toast.success('Registration Submitted!', { 
            description: 'Your account has been created and is awaiting administrator approval. You will be able to sign in once approved.' 
          });
          setIsInLogin(true);
          // Clear form fields
          setEmail('');
          setPassword('');
          setName('');
        } else {
          // Automatically sign in after successful registration (for non-staff users)
          const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (authError) {
            toast.success('Account created!', { description: 'Please sign in with your new credentials.' });
            setIsInLogin(true);
          } else {
            toast.success('Account created!', { description: `Welcome to MediFlow, ${name}! Please sign in.` });
            setIsInLogin(true);
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred during authentication');
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
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center mb-4">
              <Pill className="w-10 h-10 text-[#9867C5]" />
            </div>
            <h1 className="text-3xl font-bold text-[#9867C5]">MediFlow</h1>
            <p className="text-gray-500 text-sm">Drug Inventory Management System</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button 
              onClick={() => setIsInLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-white text-[#9867C5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsInLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-white text-[#9867C5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-5 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00897b] outline-none"
                        placeholder="John Doe"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 ml-1">Designation</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00897b] outline-none"
                    >
                      <option>Pharmacy Staff</option>
                      <option disabled>Administrator</option>
                      <option disabled>Health Officer</option>
                    </select>
                    {role === 'Pharmacy Staff' && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">
                          <strong>Admin Approval Required:</strong> Your account will be created but you must wait for administrator approval before you can sign in to the system.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isLogin && (
                <motion.div
                  key="login-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 mb-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 ml-1">Branch</label>
                    <span className="text-xs text-gray-500 italic">Optional for Admins</span>
                  </div>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00897b] outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Select a branch (not required for Admins)</option>
                      {branches.map((branch) => (
                        <option 
                          key={branch.id} 
                          value={branch.id}
                        >
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800">
                      <strong>Admin & Health Officer:</strong> You can login without selecting a branch. Branch selection is required only for Pharmacy Staff.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00897b] outline-none"
                  placeholder="name@facility.gov.ph"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00897b] outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white font-semibold rounded-xl shadow-lg shadow-[#9867C5]/40 transition-all transform active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <ShieldCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  {isLogin ? 'Sign In to System' : 'Create Account'}
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-[#fff9c4] px-8 py-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-[#f57f17] uppercase tracking-wider">Official DOH Inventory Portal</span>
          <ArrowRight className="w-3 h-3 text-[#f57f17]" />
        </div>
      </motion.div>
    </div>
  );
};