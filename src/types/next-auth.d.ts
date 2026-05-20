import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            discordId?: string;
            vtcStudentId?: string;
            locale?: string;
        } & DefaultSession["user"];
    }

    interface User {
        discordId?: string;
        vtcStudentId?: string;
        locale?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        discordId?: string;
        vtcStudentId?: string;
        locale?: string;
        lastAvatarCheck?: number;
    }
}
