'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession();
      if (!error) {
        router.push('/library');
      } else {
        router.push('/login?error=auth_callback_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <Loader2 className="animate-spin w-10 h-10 text-orange-500 mb-4" />
      <p className="text-zinc-400 font-medium tracking-wide">Finalizing your session...</p>
    </div>
  );
}
