import { notFound } from 'next/navigation';
import { conversationExists } from '../../../lib/detailRoutes';
import ConversationClient from './ConversationClient';

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!(await conversationExists(conversationId))) {
    notFound();
  }
  return <ConversationClient />;
}
