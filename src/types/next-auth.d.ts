import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            discordId?: string;
            vtcStudentId?: string;
        } & DefaultSession["user"];
    }

    interface User {
        discordId?: string;
        vtcStudentId?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        discordId?: string;
        vtcStudentId?: string;
    }
}
