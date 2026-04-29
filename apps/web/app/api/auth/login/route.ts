import { NextResponse } from "next/server";

import { ADMIN_COOKIE } from "@/lib/admin";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (
    body.email !== process.env.ADMIN_EMAIL ||
    body.password !== process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.json(
      { message: "Login yoki parol noto'g'ri." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return response;
}
