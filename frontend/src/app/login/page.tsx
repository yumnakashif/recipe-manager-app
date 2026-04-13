'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ChefHat, Mail, Lock, Loader2, ArrowRight, LogOut, User as UserIcon, Check } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setUsername(session.user.user_metadata?.display_name || '');
      }
      setInitialLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: username },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      }
      router.push('/library');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: username }
    });
    if (error) setError(error.message);
    else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
    router.refresh();
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[var(--primary)] w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[var(--background)] transition-colors duration-500 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 px-4 mt-[-40px]">
        <div className="bg-[var(--background-secondary)] border border-[var(--primary)]/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-sm">
          
          {user ? (
            /* Logged In View */
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-[var(--span-bg)] rounded-full flex items-center justify-center shadow-lg mb-4">
                <UserIcon className="text-white w-8 h-8" />
              </div>
              
              <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight mb-1">
                {username ? `Hi, ${username}` : 'Welcome!'}
              </h1>
              <p className="text-[var(--text-secondary)] text-sm opacity-60 mb-6">{user.email}</p>

              <div className="w-full space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] ml-1 uppercase tracking-widest opacity-70">Display Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your name..."
                      className="flex-1 bg-[var(--background)] border border-[var(--primary)]/10 text-[var(--text-main)] rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--primary)]/30 text-sm transition-all"
                    />
                    <button 
                      onClick={updateProfile}
                      disabled={loading}
                      className="bg-[var(--primary)] text-white p-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {showSuccess ? <Check size={18} /> : <ArrowRight size={18} />}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--primary)]/5 my-2" />

                <button
                  onClick={() => router.push('/library')}
                  className="w-full bg-[var(--background)] text-[var(--text-main)] border border-[var(--primary)]/10 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-[var(--primary)]/5 text-sm"
                >
                  <ChefHat size={18} />
                  Go to library
                </button>
                
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full text-red-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-red-500/5 text-sm"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Logged Out View */
            <>
              <div className="flex flex-col items-center mb-6">
                <div className="w-12 h-12 bg-[var(--span-bg)] rounded-xl flex items-center justify-center shadow-md mb-4">
                  <ChefHat className="text-white w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] ml-1 uppercase tracking-widest opacity-70">Pick a Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--primary)]/10 text-[var(--text-main)] rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--primary)]/30 text-sm transition-all"
                      placeholder="Chef Gordon"
                    />
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] ml-1 uppercase tracking-widest opacity-70">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--primary)]/10 text-[var(--text-main)] rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--primary)]/30 text-sm transition-all"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] ml-1 uppercase tracking-widest opacity-70">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--primary)]/10 text-[var(--text-main)] rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--primary)]/30 text-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-xs py-2 px-1 animate-pulse">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--button)] text-[var(--button-text)] font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--button)]/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 mt-2 text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isLogin ? 'Login' : 'Sign Up')}
                </button>
              </form>

              <div className="mt-8 text-center pt-6 border-t border-[var(--primary)]/5">
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors text-xs font-semibold"
                >
                  {isLogin ? (
                    <span>New here? <span className="text-[var(--secondary)]">Create an account</span></span>
                  ) : (
                    <span>Already have an account? <span className="text-[var(--secondary)]">Sign in</span></span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
