import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { createClient } from '@/app/actions/leads';
import { addToWaitingListAction } from '@/app/actions/booking';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
    const expectedKey = process.env.INTEGRATION_API_KEY || 'pb-secret-token';
    
    if (apiKey !== expectedKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, source, comment, unitId, organizationId } = body;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, phone.' }, { status: 400 });
    }

    const orgId = organizationId || 'default';

    // 1. Создаем лида в системе
    const leadResult = await createClient({
      name,
      phone,
      email: email || undefined,
      source: source || 'parkboulevard.ge',
      managerNotes: comment || 'Заявка с сайта ЖК Park Boulevard',
      organizationId: orgId,
      type: 'LEAD'
    });

    if (!leadResult.success) {
      return NextResponse.json({ success: false, error: leadResult.error, message: leadResult.message }, { status: 400 });
    }

    const newLeadId = leadResult.client?.id;

    // 2. Если указан unitId, добавляем лида в лист ожидания этой квартиры
    if (unitId && newLeadId) {
      const unitList: any[] = await prisma.$queryRaw`
        SELECT id FROM "Unit" WHERE id = ${unitId} LIMIT 1
      `;
      if (unitList.length > 0) {
        await addToWaitingListAction({
          unitId,
          leadId: newLeadId,
          organizationId: orgId
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Lead successfully created!', 
      leadId: newLeadId 
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
