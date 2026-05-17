import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const employees = await db.employee.findMany({
      include: {
        phones: {
          orderBy: { createdAt: "desc" },
        },
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map nik → nip for frontend compatibility
    const mapped = employees.map(({ nik, phones, deviceSessions, ...rest }) => ({
      ...rest,
      nip: nik,
      phones: phones.map((p) => ({
        ...p,
        employee: {
          id: p.employee.id,
          name: p.employee.name,
          nip: p.employee.nik,
          department: p.employee.department,
          position: p.employee.position,
        },
      })),
      deviceSessions,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, nip, department, position, phone } = body;

    if (!name || !nip || !department) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, nip, department",
        },
        { status: 400 }
      );
    }

    // Check for duplicate NIP
    const existingEmployee = await db.employee.findUnique({
      where: { nik: nip },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { success: false, error: "Petugas dengan NIP ini sudah terdaftar" },
        { status: 409 }
      );
    }

    const employee = await db.employee.create({
      data: {
        name,
        nik: nip,
        department,
        position: position || null,
        phone: phone || null,
      },
      include: {
        phones: true,
      },
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Duplicate field value" },
          { status: 409 }
        );
      }
    }
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
