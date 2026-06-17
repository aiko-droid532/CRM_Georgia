import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getBankTransactions, getPendingSchedules } from '@/app/actions/finance';
import FinanceClient from './FinanceClient';

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const cookieStore = cookies();
  const token = searchParams.token || cookieStore.get('auth_token')?.value;
  
  let organizationId = 'default';
  
  if (token) {
    try {
      const { payload } = await verifyToken(token);
      if (payload && typeof payload !== 'string') {
        organizationId = ((payload as any).app_metadata?.organization_id as string) || (payload.sub as string);
      }
    } catch (e) {
      console.error('Token verification failed:', e);
    }
  }

  // Загружаем данные для финансов
  const transactions = await getBankTransactions(organizationId);
  const pendingSchedules = await getPendingSchedules(organizationId);

  return (
    <FinanceClient 
      initialTransactions={transactions}
      initialSchedules={pendingSchedules}
      organizationId={organizationId}
    />
  );
}
