import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const type = searchParams.get("type") || undefined;
    const date = searchParams.get("date") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const phoneId = searchParams.get("phoneId") || undefined;

    const where: Prisma.CheckLogWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        where.checkedAt = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (phoneId) {
      where.phoneId = phoneId;
    }

    const total = await db.checkLog.count({ where });

    const logs = await db.checkLog.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            nik: true,
            department: true,
            position: true,
          },
        },
        phone: {
          select: {
            id: true,
            brand: true,
            model: true,
            imei: true,
            color: true,
            phoneType: true,
            phonePhoto: true,
          },
        },
      },
      orderBy: { checkedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    // Return flat structure matching frontend HistoryResponse
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      type: log.type,
      checkedAt: log.checkedAt.toISOString(),
      employee: {
        name: log.employee.name,
        department: log.employee.department,
      },
      phone: {
        brand: log.phone.brand,
        model: log.phone.model,
        color: log.phone.color,
        phoneType: log.phone.phoneType,
        phonePhoto: log.phone.phonePhoto,
      },
    }));

    return NextResponse.json(
      {
        logs: formattedLogs,
        total,
        page,
        totalPages,
      },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  } catch (error) {
    console.error("Error fetching check logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch check logs" },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  }
}
