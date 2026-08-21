import { Suspense } from 'react';
import RegisterForm from '@/modules/auth/components/RegisterForm';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RegisterForm />
    </Suspense>
  );
}
