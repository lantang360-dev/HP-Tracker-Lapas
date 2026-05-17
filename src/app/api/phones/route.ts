import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

// Map nik → nip in phone employee data for frontend compatibility
function mapPhoneNik(phone: any) {
  return {
    ...phone,
    employee: phone.employee ? {
      id: phone.employee.id,
      name: phone.employee.name,
      nip: phone.employee.nik,
      department: phone.employee.department,
      position: phone.employee.position,
      ...(phone.employee.phone !== undefined && { phone: phone.employee.phone }),
    } : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Prisma.PhoneRegistrationWhereInput = {};
    if (status) {
      where.status = status;
    }

    const phones = await db.phoneRegistration.findMany({
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(phones.map(mapPhoneNik), {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error("Error fetching phones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch phone registrations" },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, brand, model, imei, color, status, phoneType, phonePhoto } = body;

    if (!employeeId || !brand || !model || !imei) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: employeeId, brand, model, imei",
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        }
      );
    }

    // Check if employee exists
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        }
      );
    }

    // Check for duplicate IMEI
    const existingImei = await db.phoneRegistration.findUnique({
      where: { imei },
    });

    if (existingImei) {
      return NextResponse.json(
        { success: false, error: "A phone with this IMEI is already registered" },
        {
          status: 409,
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        }
      );
    }

    // Generate a unique QR code value
    let qrCode = randomUUID();
    // Ensure uniqueness (very unlikely collision, but safety check)
    let qrExists = await db.phoneRegistration.findUnique({
      where: { qrCode },
    });
    while (qrExists) {
      qrCode = randomUUID();
      qrExists = await db.phoneRegistration.findUnique({
        where: { qrCode },
      });
    }

    const phone = await db.phoneRegistration.create({
      data: {
        employeeId,
        brand,
        model,
        imei,
        color: color || null,
        phoneType: phoneType || "Smartphone",
        phonePhoto: phonePhoto || null,
        status: status || "active",
        qrCode,
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

    return NextResponse.json(mapPhoneNik(phone), {
      status: 201,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Duplicate field value" },
          {
            status: 409,
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
          }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { success: false, error: "Related record not found" },
          {
            status: 404,
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
          }
        );
      }
    }
    console.error("Error creating phone registration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register phone" },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      }
    );
  }
}
