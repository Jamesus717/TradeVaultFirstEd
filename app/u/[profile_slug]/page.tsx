import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { profileSlugExists } from '../../../lib/detailRoutes';
import { cardMetadata, loadProfileCard } from '../../../lib/shareCards';
import PublicProfileClient from './PublicProfileClient';

export async function generateMetadata({ params }: { params: Promise<{ profile_slug: string }> }): Promise<Metadata> {
  const { profile_slug } = await params;
  return cardMetadata(await loadProfileCard(profile_slug), `/u/${encodeURIComponent(profile_slug)}`);
}

export default async function PublicProfilePage({ params }: { params: Promise<{ profile_slug: string }> }) {
  const { profile_slug } = await params;
  if (!(await profileSlugExists(profile_slug))) {
    notFound();
  }
  return <PublicProfileClient params={params} />;
}
