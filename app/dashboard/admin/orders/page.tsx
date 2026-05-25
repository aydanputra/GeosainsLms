import { redirect } from 'next/navigation';

export default async function Page() {
  redirect('/dashboard/admin/sales/orders');
}
