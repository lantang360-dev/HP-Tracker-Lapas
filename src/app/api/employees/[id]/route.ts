import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        phones: { orderBy: { createdAt: "desc" } },
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Petugas tidak ditemukan" },
        { status: 404 }
      );
    }

    // Map nik → nip for frontend compatibility
    const { nik, phones, deviceSessions, ...rest } = employee;
    const mapped = {
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
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if employee exists
    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Petugas tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check for duplicate NIP (excluding current employee)
    if (nip !== existing.nik) {
      const duplicateNip = await db.employee.findUnique({ where: { nik: nip } });
      if (duplicateNip) {
        return NextResponse.json(
          { success: false, error: "Petugas dengan NIP ini sudah terdaftar" },
          { status: 409 }
        );
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: {
        name,
        nik: nip,
        department,
        position: position || null,
        phone: phone || null,
      },
      include: {
        phones: true,
        deviceSessions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Map nik → nip for frontend compatibility
    const { nik: _, phones, deviceSessions, ...rest } = employee;
    const mapped = {
      ...rest,
      nip: employee.nik,
      phones,
      deviceSessions,
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Duplicate field value" },
          { status: 409 }
        );
      }
    }
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if employee exists
    const existing = await db.employee.findUnique({
      where: { id },
      include: {
        phones: true,
        deviceSessions: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Petugas tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if employee has phones registered (safety check)
    if (existing.phones.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Petugas ini memiliki ${existing.phones.length} HP terdaftar. Hapus HP terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Delete device sessions first (foreign key dependency)
    if (existing.deviceSessions.length > 0) {
      await db.deviceSession.deleteMany({ where: { employeeId: id } });
    }

    // Delete employee
    await db.employee.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Petugas ${existing.name} berhasil dihapus`,
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
