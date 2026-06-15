import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getDeals } from '@/app/actions/deals';
import DealsClient from './DealsClient';

export default async function DealsPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const cookieStore = cookies();
  const token = searchParams.token || cookieStore.get('auth_token')?.value;
  
  let organizationId = 'default';
  
  if (token) {
    const { payload } = await verifyToken(token);
    if (payload && typeof payload !== 'string') {
      organizationId = ((payload as any).app_metadata?.organization_id as string) || (payload.sub as string);
    }
  }

  const deals = await getDeals(organizationId);

  return <DealsClient initialDeals={deals} organizationId={organizationId} />;
}
