import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Discord,
        Credentials({
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "your.email@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    await connectDB();

                    // Find user by email
                    const user = await User.findOne({ email: credentials.email }).lean();

                    if (!user || !user.password) {
                        return null;
                    }

                    // Verify password
                    const isValid = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!isValid) {
                        return null;
                    }

                    // Return user object for session
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.discordUsername || user.email,
                        image: user.discordAvatar,
                        discordId: user.discordId,
                        vtcStudentId: user.vtcStudentId,
                    };
                } catch (error) {
                    console.error("Error during credentials authorization:", error);
                    return null;
                }
            }
        })
    ],
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
            // Add custom fields to session
            if (token.sub) {
                session.user.discordId = token.sub;
            }
            if (token.vtcStudentId) {
                session.user.vtcStudentId = token.vtcStudentId as string;
            }
            if (token.email) {
                session.user.email = token.email as string;
            }
            return session;
        },
        async jwt({ token, account, user }) {
            // Initial sign in
            if (account?.provider === "discord") {
                token.sub = account.providerAccountId;

                // Fetch vtcStudentId from database
                try {
                    await connectDB();
                    const dbUser = await User.findOne({ discordId: account.providerAccountId }).lean();
                    if (dbUser?.vtcStudentId) {
                        token.vtcStudentId = dbUser.vtcStudentId;
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else if (account?.provider === "credentials" && user) {
                // For credentials login, user object already contains all data from authorize()
                token.sub = user.discordId as string;
                token.vtcStudentId = user.vtcStudentId as string;
                token.email = user.email;
            }

            return token;
        },
    },
});
