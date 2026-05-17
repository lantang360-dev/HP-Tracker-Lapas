import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Map nik → nip in phone employee data for frontend compatibility
function mapPhoneNik(phone: any) {
  return {
    ...phone,
    employee: phone.employee
      ? {
          id: phone.employee.id,
          name: phone.employee.name,
          nip: phone.employee.nik,
          department: phone.employee.department,
          position: phone.employee.position,
          ...(phone.employee.phone !== undefined && {
            phone: phone.employee.phone,
          }),
        }
      : undefined,
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const phone = await db.phoneRegistration.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            nik: true,
            department: true,
            position: true,
            phone: true,
          },
        },
        checkLogs: {
          orderBy: { checkedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone registration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: mapPhoneNik(phone) });
  } catch (error) {
    console.error("Error fetching phone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch phone registration" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brand, model, imei, color, status, phoneType, phonePhoto } = body;

    // Check phone exists
    const existing = await db.phoneRegistration.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Phone registration not found" },
        { status: 404 },
      );
    }

    // Check for duplicate IMEI if changing
    if (imei && imei !== existing.imei) {
      const duplicateImei = await db.phoneRegistration.findUnique({
        where: { imei },
      });
      if (duplicateImei) {
        return NextResponse.json(
          {
            success: false,
            error: "A phone with this IMEI is already registered",
          },
          { status: 409 },
        );
      }
    }

    const phone = await db.phoneRegistration.update({
      where: { id },
      data: {
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(imei !== undefined && { imei }),
        ...(color !== undefined && { color }),
        ...(phoneType !== undefined && { phoneType }),
        ...(phonePhoto !== undefined && { phonePhoto }),
        ...(status !== undefined && { status }),
      },
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
      },
    });

    return NextResponse.json({ success: true, data: mapPhoneNik(phone) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Duplicate field value" },
          { status: 409 },
        );
      }
    }
    console.error("Error updating phone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update phone registration" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check phone exists
    const phone = await db.phoneRegistration.findUnique({
      where: { id },
      include: {
        checkLogs: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone registration not found" },
        { status: 404 },
      );
    }

    // Check if phone is currently checked in
    const latestLog = phone.checkLogs[0];
    if (latestLog && latestLog.type === "check_in") {
      return NextResponse.json(
        {
          success: false,
          error:
            "HP sedang berada di dalam. Silakan check-out terlebih dahulu.",
        },
        { status: 409 },
      );
    }

    // Delete related records first (foreign key dependencies)
    await db.checkLog.deleteMany({ where: { phoneId: id } });
    await db.dailyBarcode.deleteMany({ where: { phoneId: id } });

    // Then delete the phone
    await db.phoneRegistration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "HP berhasil dihapus dari sistem",
    });
  } catch (error) {
    console.error("Error deleting phone:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete phone registration" },
      { status: 500 },
    );
  }
}
