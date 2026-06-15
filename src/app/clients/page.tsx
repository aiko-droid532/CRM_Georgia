import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getLeads } from '@/app/actions/leads';
import { getProjects } from '@/app/actions/units';
import ClientManagementClient from './ClientManagementClient';

export default async function ClientsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  
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

  const leads = await getLeads(organizationId);
  const projects = await getProjects(organizationId);

  return (
    <ClientManagementClient 
      initialLeads={leads} 
      projects={projects} 
      organizationId={organizationId} 
    />
  );
}
