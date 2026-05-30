import { getSession } from "./session";
import { db } from "@/lib/db";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}
