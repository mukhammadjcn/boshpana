import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE } from "@/lib/admin";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const cookieStore = await cookies();

  if (cookieStore.get(ADMIN_COOKIE)?.value !== "1") {
    return NextResponse.json({ message: "Admin access required." }, { status: 401 });
  }

  const { path } = await context.params;
  const target = `${
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
  }/internal/admin/${path.join("/")}${request.nextUrl.search}`;
  const body =
    request.method === "GET" || request.method === "DELETE"
      ? undefined
      : await request.text();

  const response = await fetch(target, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": process.env.ADMIN_JWT_SECRET ?? "super-secret-admin-jwt"
    },
    body,
    cache: "no-store"
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json"
    }
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}
