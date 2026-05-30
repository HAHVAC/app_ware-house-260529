import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const db = new PrismaClient({ adapter });

async function main() {
  const username = "admin";
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    console.log("Tai khoan admin da ton tai, bo qua seed.");
    return;
  }
  await db.user.create({
    data: {
      fullName: "Quản trị viên",
      username,
      passwordHash: await hashPassword("admin123"),
      companyRole: "ADMIN",
      isActive: true,
    },
  });
  console.log("Da tao tai khoan admin / admin123");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
