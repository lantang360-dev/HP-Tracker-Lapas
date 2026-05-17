import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import QRCode from "qrcode";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const phone = await db.phoneRegistration.findUnique({
      where: { id },
      select: { qrCode: true, id: true },
    });

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone registration not found" },
        { status: 404 }
      );
    }

    const svgString = await QRCode.toString(phone.qrCode, {
      type: "svg",
      width: 256,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(svgString, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
