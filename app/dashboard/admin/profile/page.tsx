export default async function Page() {
  const { redirect } = await import('next/navigation');
  redirect('/dashboard/profile');
}
