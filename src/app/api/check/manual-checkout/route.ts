import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneId } = body as { phoneId: string };

    if (!phoneId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: phoneId" },
        { status: 400 }
      );
    }

    // Find the phone registration
    const phone = await db.phoneRegistration.findUnique({
      where: { id: phoneId },
      include: {
        employee: {
          select: {
            id: true, name: true, nik: true, department: true, position: true,
          },
        },
      },
    });

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone registration not found" },
        { status: 404 }
      );
    }

    // Check if phone is currently checked in (optimized single query)
    const latestLog = await db.checkLog.findFirst({
      where: { phoneId },
      orderBy: { checkedAt: "desc" },
    });

    if (!latestLog || latestLog.type !== "check_in") {
      return NextResponse.json(
        {
          success: false,
          error: "This phone is not currently checked in. Cannot perform manual checkout.",
        },
        { status: 409 }
      );
    }

    // Create check_out log entry
    const checkOutLog = await db.checkLog.create({
      data: {
        phoneId,
        employeeId: phone.employeeId,
        type: "check_out",
        notes: "Manual checkout",
      },
      include: {
        employee: {
          select: {
            id: true, name: true, nik: true, department: true, position: true,
          },
        },
        phone: {
          select: {
            id: true, brand: true, model: true, imei: true, color: true, qrCode: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${phone.employee.name} has been manually checked out with ${phone.brand} ${phone.model}`,
      data: checkOutLog,
    });
  } catch (error) {
    console.error("Error performing manual checkout:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform manual checkout" },
      { status: 500 }
    );
  }
}
