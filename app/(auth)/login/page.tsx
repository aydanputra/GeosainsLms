import { Suspense } from 'react';
import LoginForm from '@/modules/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
