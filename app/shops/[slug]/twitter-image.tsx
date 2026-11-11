import { loadShopCard } from '../../../lib/shareCards';
import { renderShareImage, SHARE_SIZE } from '../../../lib/shareImage';

export const alt = 'TradeBinder shop';
export const size = SHARE_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareImage(await loadShopCard(slug));
}
