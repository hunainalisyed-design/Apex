/**
 * One-off CLI to grant a user the ADMIN role (Spec 21, Risk #1) — there is deliberately no
 * self-service path to ADMIN anywhere in the product (see schema.prisma's own comment on
 * User.role), so this is the only way to create the first admin.
 *
 * Usage: npx tsx scripts/promoteAdmin.ts <email>
 */
import { prisma } from "../src/lib/prisma.js";
import { normalizeEmail } from "../src/services/auth/user.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/promoteAdmin.ts <email>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exitCode = 1;
    return;
  }

  if (user.role === "ADMIN") {
    console.log(`${user.email} is already an ADMIN.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`${user.email} promoted to ADMIN.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
