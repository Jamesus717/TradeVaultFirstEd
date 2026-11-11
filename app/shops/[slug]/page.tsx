import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { shopExists } from '../../../lib/detailRoutes';
import { cardMetadata, loadShopCard } from '../../../lib/shareCards';
import ShopClient from './ShopClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return cardMetadata(await loadShopCard(slug), `/shops/${encodeURIComponent(slug)}`);
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await shopExists(slug))) {
    notFound();
  }
  return <ShopClient />;
}
