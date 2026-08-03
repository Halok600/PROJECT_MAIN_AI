import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${GMAIL_READONLY_SCOPE} ${DRIVE_READONLY_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.accessTokenExpiresAt = token.accessTokenExpiresAt;
      return session;
    },
  },
});
