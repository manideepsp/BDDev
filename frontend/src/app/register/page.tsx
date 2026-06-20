'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await registerUser(form);
      await refresh();
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              KS
            </div>
            <span className="text-foreground font-semibold text-lg">KS Business</span>
          </div>
          <p className="text-muted-foreground text-sm">Create your account</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full name</label>
                <Input
                  type="text"
                  required
                  autoComplete="name"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Alex Johnson"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="alex@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
