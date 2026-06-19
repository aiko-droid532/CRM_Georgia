import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getFunnelReportData,
  getDealTransitions,
  getProjectSalesReportData,
  getManagerSalesReportData,
  getSalesCashFlowData,
  getPaymentRegistryData,
  getDebtorsRegistryData,
  getCashFlowReportData,
  getDiscountReportData,
  getMortgageReportData,
  getManagerKpiData,
  getMarketingChannelsData,
  getProjectsList,
  getManagersList,
  getBlocksList,
  getSourcesList,
  getPaymentTypesList,
  getUnitTypesList
} from '@/app/actions/reports';
import ReportsClient from './ReportsClient';

export default async function ReportsPage({
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

  // Загружаем данные для отчетов
  const funnelData = await getFunnelReportData(organizationId);
  const dealTransitions = await getDealTransitions(organizationId);
  const projectSales = await getProjectSalesReportData(organizationId);
  const managerSales = await getManagerSalesReportData(organizationId);
  const cashFlow = await getSalesCashFlowData(organizationId);
  const paymentRegistry = await getPaymentRegistryData(organizationId);
  const debtors = await getDebtorsRegistryData(organizationId);
  const cashFlowReport = await getCashFlowReportData(organizationId);
  const discountReport = await getDiscountReportData(organizationId);
  const mortgageReport = await getMortgageReportData(organizationId);
  const managerKpi = await getManagerKpiData(organizationId);
  const marketingChannels = await getMarketingChannelsData(organizationId);

  // Загружаем динамические справочники для фильтров
  const projects = await getProjectsList(organizationId);
  const managers = await getManagersList(organizationId);
  const blocks = await getBlocksList(organizationId);
  const sources = await getSourcesList(organizationId);
  const paymentTypes = await getPaymentTypesList(organizationId);
  const unitTypes = await getUnitTypesList(organizationId);

  return (
    <ReportsClient
      organizationId={organizationId}
      projects={projects}
      managers={managers}
      blocks={blocks}
      sources={sources}
      paymentTypes={paymentTypes}
      unitTypes={unitTypes}
      initialData={{
        funnelData,
        dealTransitions,
        projectSales,
        managerSales,
        cashFlow,
        paymentRegistry,
        debtors,
        cashFlowReport,
        discountReport,
        mortgageReport,
        managerKpi,
        marketingChannels
      }}
    />
  );
}