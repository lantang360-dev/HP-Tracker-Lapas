import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get all active phone registrations with employee data
    const activePhones = await db.phoneRegistration.findMany({
      where: { status: 'active' },
      include: {
        employee: {
          select: { id: true, name: true, department: true, position: true },
        },
      },
    });

    if (activePhones.length === 0) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
    }

    // Check each phone sequentially for maximum database compatibility
    const insidePhones: Array<{
      phoneId: string;
      phone: { id: string; brand: string; model: string; color: string | null; imei: string; phoneType: string | null; phonePhoto: string | null };
      employee: { id: string; name: string; department: string; position: string | null };
      checkedAt: string;
    }> = [];

    for (const phone of activePhones) {
      try {
        const latestLog = await db.checkLog.findFirst({
          where: { phoneId: phone.id },
          orderBy: { checkedAt: "desc" },
          select: { type: true, checkedAt: true },
        });

        if (latestLog?.type === 'check_in') {
          insidePhones.push({
            phoneId: phone.id,
            phone: {
              id: phone.id,
              brand: phone.brand,
              model: phone.model,
              color: phone.color,
              imei: phone.imei,
              phoneType: phone.phoneType,
              phonePhoto: phone.phonePhoto,
            },
            employee: {
              id: phone.employee.id,
              name: phone.employee.name,
              department: phone.employee.department,
              position: phone.employee.position,
            },
            checkedAt: latestLog.checkedAt.toISOString(),
          });
        }
      } catch {
        // Skip phone if query fails
      }
    }

    // Sort by checkedAt descending
    insidePhones.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    return NextResponse.json(insidePhones, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error("Error fetching inside phones:", error);
    return NextResponse.json(
      { error: "Failed to fetch phones currently inside" },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  }
}
