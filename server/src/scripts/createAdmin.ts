/**
 * Creates or promotes the first admin user. Run after migrations.
 *
 * Requires in server/.env (or environment):
 *   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * Idempotent: if a user already exists with that email or username, they are
 * updated to role `admin` and the password is reset to ADMIN_PASSWORD.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import getPrismaClient from "../db/prismaConnection";

const requireEnv = (name: string): string => {
    const v = process.env[name]?.trim();
    if (!v) {
        console.error(`Missing ${name}. Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD (e.g. in server/.env).`);
        process.exit(1);
    }
    return v;
};

async function main() {
    const username = requireEnv("ADMIN_USERNAME");
    const email = requireEnv("ADMIN_EMAIL");
    const password = requireEnv("ADMIN_PASSWORD");
    const hashedPassword = await bcrypt.hash(password, 10);

    const prisma = getPrismaClient();

    const byEmail = await prisma.user.findUnique({ where: { email } });
    const byUsername = await prisma.user.findUnique({ where: { username } });

    if (byEmail && byUsername && byEmail.id !== byUsername.id) {
        console.error(
            "ADMIN_EMAIL and ADMIN_USERNAME belong to two different users. Use values that match one account, or free one of the fields."
        );
        process.exit(1);
    }

    const existing = byEmail ?? byUsername;
    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: {
                username,
                email,
                password: hashedPassword,
                role: "admin"
            }
        });
        console.log(`Updated existing user to admin: ${email}`);
    } else {
        await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: "admin"
            }
        });
        console.log(`Created admin user: ${email}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        const prisma = getPrismaClient();
        await prisma.$disconnect();
    });
