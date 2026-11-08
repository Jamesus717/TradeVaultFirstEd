import { notFound } from 'next/navigation';
import { shopExists } from '../../../lib/detailRoutes';
import ShopClient from './ShopClient';

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await shopExists(slug))) {
    notFound();
  }
  return <ShopClient />;
}
