import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "Missing employeeId" },
        { status: 400 }
      );
    }

    // Find active phones for this employee
    const phones = await db.phoneRegistration.findMany({
      where: { employeeId, status: "active" },
      select: { id: true, brand: true, model: true, imei: true, color: true },
    });

    if (phones.length === 0) {
      return NextResponse.json({
        success: true,
        hasPhone: false,
        phoneInside: false,
        phones: [],
      });
    }

    // For each phone, check latest log
    const results = await Promise.all(
      phones.map(async (phone) => {
        const latestLog = await db.checkLog.findFirst({
          where: { phoneId: phone.id },
          orderBy: { checkedAt: "desc" },
          select: { type: true, checkedAt: true },
        });

        const isInside = latestLog?.type === 'check_in';
        return {
          ...phone,
          checkedInAt: isInside ? latestLog!.checkedAt.toISOString() : null,
        };
      })
    );

    const insidePhones = results.filter(p => p.checkedInAt !== null);

    return NextResponse.json({
      success: true,
      hasPhone: true,
      phoneInside: insidePhones.length > 0,
      insidePhones,
      allPhones: phones,
    });
  } catch (error) {
    console.error("Error checking phone status:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengecek status HP" },
      { status: 500 }
    );
  }
}
