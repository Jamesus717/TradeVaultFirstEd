import { notFound } from 'next/navigation';
import { profileExists } from '../../../lib/detailRoutes';
import ProfileClient from './ProfileClient';

export default async function ProfilePage({ params }: { params: Promise<{ user_id: string }> }) {
  const { user_id } = await params;
  if (!(await profileExists(user_id))) {
    notFound();
  }
  return <ProfileClient params={params} />;
}
