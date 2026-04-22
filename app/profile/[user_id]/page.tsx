'use client';

import { useEffect, useState } from 'react';
import ProfileView from '../ProfileView';

type ProfilePageProps = {
  params: Promise<{
    user_id: string;
  }>;
};

export default function ProfilePage({ params }: ProfilePageProps) {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setUserId(resolved.user_id);
    }

    resolveParams();
  }, [params]);

  return <ProfileView userId={userId} />;
}
