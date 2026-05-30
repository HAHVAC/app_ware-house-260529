import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
}

// Thời hạn phiên: 8 giờ (≈ một ca làm việc). Hết hạn sẽ phải đăng nhập lại —
// phù hợp với thiết bị dùng chung tại công trường. Đổi giá trị này nếu cần.
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "wms_session",
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_TTL_SECONDS,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
