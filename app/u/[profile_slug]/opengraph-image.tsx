import { loadProfileCard } from '../../../lib/shareCards';
import { renderShareImage, SHARE_SIZE } from '../../../lib/shareImage';

export const alt = 'TradeBinder profile';
export const size = SHARE_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ profile_slug: string }> }) {
  const { profile_slug } = await params;
  return renderShareImage(await loadProfileCard(profile_slug));
}
