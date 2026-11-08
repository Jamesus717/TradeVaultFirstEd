import { notFound } from 'next/navigation';
import { profileSlugExists } from '../../../lib/detailRoutes';
import PublicProfileClient from './PublicProfileClient';

export default async function PublicProfilePage({ params }: { params: Promise<{ profile_slug: string }> }) {
  const { profile_slug } = await params;
  if (!(await profileSlugExists(profile_slug))) {
    notFound();
  }
  return <PublicProfileClient params={params} />;
}
