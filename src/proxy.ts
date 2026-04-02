import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (process.env.VERCEL_ENV === "preview") return NextResponse.next();
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
