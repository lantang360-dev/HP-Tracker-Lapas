import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type CheckType = "check_in" | "check_out";

/**
 * Check if any active phone of an employee is currently inside.
 * Simple reliable approach: get all active phones, check latest log for each.
 */
async function getEmployeeCheckedInPhoneId(employeeId: string): Promise<string | null> {
  const activePhones = await db.phoneRegistration.findMany({
    where: { employeeId, status: 'active' },
    select: { id: true },
  });

  if (activePhones.length === 0) return null;

  for (const phone of activePhones) {
    const latestLog = await db.checkLog.findFirst({
      where: { phoneId: phone.id },
      orderBy: { checkedAt: "desc" },
      select: { type: true },
    });
    if (latestLog?.type === 'check_in') return phone.id;
  }

  return null;
}

/**
 * Check if a specific phone is currently inside.
 */
async function isPhoneInside(phoneId: string): Promise<boolean> {
  const latestLog = await db.checkLog.findFirst({
    where: { phoneId },
    orderBy: { checkedAt: "desc" },
    select: { type: true },
  });
  return latestLog?.type === 'check_in';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, type: explicitType } = body as {
      qrCode: string;
      type?: CheckType;
    };

    if (!qrCode) {
      return NextResponse.json(
        { success: false, error: "Missing required field: qrCode" },
        { status: 400 }
      );
    }

    // Find phone by qrCode - try phone registration first, then daily barcode
    let phone = await db.phoneRegistration.findUnique({
      where: { qrCode },
      include: {
        employee: {
          select: {
            id: true, name: true, nik: true, department: true, position: true,
          },
        },
      },
    });

    // If not found in phone registrations, try daily barcodes
    if (!phone) {
      const dailyBarcode = await db.dailyBarcode.findUnique({
        where: { qrCode },
        include: {
          phone: {
            include: {
              employee: {
                select: {
                  id: true, name: true, nik: true, department: true, position: true,
                },
              },
            },
          },
        },
      });

      if (dailyBarcode) {
        phone = dailyBarcode.phone;
      }
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "QR code tidak valid. HP tidak terdaftar." },
        { status: 404 }
      );
    }

    if (phone.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Pendaftaran HP ini sudah tidak aktif" },
        { status: 403 }
      );
    }

    const phoneIsInside = await isPhoneInside(phone.id);

    // Auto-detect type if not explicitly provided
    let type: CheckType = explicitType || (phoneIsInside ? "check_out" : "check_in");

    if (explicitType && explicitType !== "check_in" && explicitType !== "check_out") {
      return NextResponse.json(
        { success: false, error: "Invalid type. Must be 'check_in' or 'check_out'" },
        { status: 400 }
      );
    }

    if (type === "check_in") {
      if (phoneIsInside) {
        return NextResponse.json(
          {
            success: false,
            error: "HP ini sudah tercatat masuk. Silakan scan ulang untuk check-out.",
          },
          { status: 409 }
        );
      }

      // Check if the employee already has another phone checked in
      const existingCheckedInPhoneId = await getEmployeeCheckedInPhoneId(phone.employeeId);
      if (existingCheckedInPhoneId) {
        const existingPhone = await db.phoneRegistration.findUnique({
          where: { id: existingCheckedInPhoneId },
          select: { brand: true, model: true },
        });
        return NextResponse.json(
          {
            success: false,
            error: `Petugas ${phone.employee.name} sudah membawa HP lain ke dalam (${existingPhone?.brand || ''} ${existingPhone?.model || ''}). Satu petugas hanya boleh membawa satu HP.`,
          },
          { status: 409 }
        );
      }
    }

    if (type === "check_out") {
      if (!phoneIsInside) {
        return NextResponse.json(
          {
            success: false,
            error: "HP ini belum tercatat masuk. Silakan scan untuk check-in terlebih dahulu.",
          },
          { status: 409 }
        );
      }
    }

    // Create the check log
    const checkLog = await db.checkLog.create({
      data: {
        phoneId: phone.id,
        employeeId: phone.employeeId,
        type,
      },
      include: {
        employee: {
          select: {
            id: true, name: true, nik: true, department: true, position: true,
          },
        },
        phone: {
          select: {
            id: true, brand: true, model: true, imei: true, color: true, qrCode: true, phoneType: true, phonePhoto: true,
          },
        },
      },
    });

    const actionText = type === "check_in" ? "check-in" : "check-out";

    return NextResponse.json({
      type: checkLog.type,
      checkedAt: checkLog.checkedAt.toISOString(),
      employee: {
        name: checkLog.employee.name,
        department: checkLog.employee.department,
        position: checkLog.employee.position,
      },
      phone: {
        brand: checkLog.phone.brand,
        model: checkLog.phone.model,
        imei: checkLog.phone.imei,
        color: checkLog.phone.color,
        phoneType: checkLog.phone.phoneType,
        phonePhoto: checkLog.phone.phonePhoto,
      },
      message: `${phone.employee.name} berhasil ${actionText} dengan ${phone.brand} ${phone.model}`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma error in check:", error.code, error.message);
    } else {
      console.error("Error processing check:", error);
    }
    return NextResponse.json(
      { success: false, error: "Gagal memproses check-in/check-out" },
      { status: 500 }
    );
  }
}
