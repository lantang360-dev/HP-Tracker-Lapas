import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function getTodayRangeWIB(): { start: Date; end: Date } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(now);
  const start = new Date(`${todayStr}T00:00:00+08:00`);
  const end = new Date(`${todayStr}T23:59:59.999+08:00`);
  return { start, end };
}

export async function GET() {
  try {
    const { start, end } = getTodayRangeWIB();

    // Run in parallel - only 3 queries
    const [counts, recentLogs, activePhones] = await Promise.all([
      // Query 1: All counts in one batch
      Promise.all([
        db.employee.count(),
        db.phoneRegistration.count({ where: { status: 'active' } }),
        db.checkLog.count({ where: { type: "check_in", checkedAt: { gte: start, lte: end } } }),
        db.checkLog.count({ where: { type: "check_out", checkedAt: { gte: start, lte: end } } }),
      ]),

      // Query 2: Recent logs
      db.checkLog.findMany({
        take: 10,
        orderBy: { checkedAt: "desc" },
        include: {
          employee: { select: { id: true, name: true, nik: true, department: true, position: true } },
          phone: { select: { id: true, brand: true, model: true, imei: true, color: true, phoneType: true, phonePhoto: true } },
        },
      }),

      // Query 3: Active phone IDs for checking inside status
      db.phoneRegistration.findMany({
        where: { status: 'active' },
        select: { id: true },
      }),
    ]);

    const [totalEmployees, totalPhones, todayCheckIns, todayCheckOuts] = counts;

    // Query 4: Check inside status for all phones in parallel
    let currentlyInside = 0;
    if (activePhones.length > 0) {
      const insideChecks = await Promise.all(
        activePhones.map(phone =>
          db.checkLog.findFirst({
            where: { phoneId: phone.id },
            orderBy: { checkedAt: "desc" },
            select: { type: true },
          }).then(log => log?.type === 'check_in' ? 1 : 0)
        )
      );
      currentlyInside = insideChecks.reduce((a, b) => a + b, 0);
    }

    return NextResponse.json(
      {
        totalEmployees,
        totalPhones,
        currentlyInside,
        todayCheckIns,
        todayCheckOuts,
        recentLogs,
      },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard statistics" },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  }
}
