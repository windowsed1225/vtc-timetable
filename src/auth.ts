import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import connectDB from "@/lib/db";
import User from "@/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [Discord],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "discord") {
                try {
                    await connectDB();
                    await User.findOneAndUpdate(
                        { discordId: account.providerAccountId },
                        {
                            discordId: account.providerAccountId,
                            discordUsername: user.name,
                            discordAvatar: user.image,
                        },
                        { upsert: true, new: true }
                    );
                } catch (error) {
                    console.error("Error saving user to database:", error);
                    // Still allow sign in even if DB save fails
                }
            }
            return true;
        },
        async session({ session, token }) {
            if (token.sub) {
                session.user.discordId = token.sub;
            }
            return session;
        },
        async jwt({ token, account }) {
            if (account) {
                token.sub = account.providerAccountId;
            }
            return token;
        },
    },
});
