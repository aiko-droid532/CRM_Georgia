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
  getManagerKpiData,
  getMarketingChannelsData,
  getProjectsList,
  getManagersList,
  getBlocksList,
  getSourcesList,
  getPaymentTypesList,
  getUnitTypesList,
  getContractDraftsReportData,
  getSalesDynamicsReportData,
  getCohortAnalysisReportData,
  getDiscountReportData,
  getMortgageReportData,
  getTaxInvoiceReportData,
  getEscrowReportData,
  getAvailableUnitsReportData,
  getSoldUnitsReportData,
  getProjectExposureReportData,
  getFreeUnitsSearchData,
  getPriceHistoryReportData,
  getAreaDiscrepancyReportData
} from '@/app/actions/reports';
import { getExchangeRate } from '@/app/actions/exchange';
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
  const managerKpi = await getManagerKpiData(organizationId);
  const marketingChannels = await getMarketingChannelsData(organizationId);
  const contractDrafts = await getContractDraftsReportData(organizationId);
  const salesDynamics = await getSalesDynamicsReportData(organizationId);
  const cohortAnalysis = await getCohortAnalysisReportData(organizationId);
  const discountReport = await getDiscountReportData(organizationId);
  const mortgageReport = await getMortgageReportData(organizationId);
  const taxInvoiceReport = await getTaxInvoiceReportData(organizationId);
  const escrowReport = await getEscrowReportData(organizationId);
  const availableUnits = await getAvailableUnitsReportData(organizationId);
  const soldUnits = await getSoldUnitsReportData(organizationId);
  const projectExposure = await getProjectExposureReportData(organizationId);
  const freeUnitsSearch = await getFreeUnitsSearchData(organizationId);
  const priceHistory = await getPriceHistoryReportData(organizationId);
  const areaDiscrepancy = await getAreaDiscrepancyReportData(organizationId);

  // Загружаем динамические справочники для фильтров
  const projects = await getProjectsList(organizationId);
  const managers = await getManagersList(organizationId);
  const blocks = await getBlocksList(organizationId);
  const sources = await getSourcesList(organizationId);
  const paymentTypes = await getPaymentTypesList(organizationId);
  const unitTypes = await getUnitTypesList(organizationId);

  // Загружаем текущий курс доллара к лари (из БД или API)
  const usdRate = await getExchangeRate();

  return (
    <ReportsClient
      organizationId={organizationId}
      projects={projects}
      managers={managers}
      blocks={blocks}
      sources={sources}
      paymentTypes={paymentTypes}
      unitTypes={unitTypes}
      usdRate={usdRate}
      initialData={{
        funnelData,
        dealTransitions,
        projectSales,
        managerSales,
        cashFlow,
        paymentRegistry,
        debtors,
        cashFlowReport,
        managerKpi,
        marketingChannels,
        contractDrafts,
        salesDynamics,
        cohortAnalysis,
        discountReport,
        mortgageReport,
        taxInvoiceReport,
        escrowReport,
        availableUnits,
        soldUnits,
        projectExposure,
        freeUnitsSearch,
        priceHistory,
        areaDiscrepancy
      }}
    />
  );
}