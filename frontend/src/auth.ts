import { SvelteKitAuth } from "@auth/sveltekit";
import Google from "@auth/sveltekit/providers/google";
import GitHub from "@auth/sveltekit/providers/github";

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [Google, GitHub],
	session: { strategy: "jwt" },
	callbacks: {
		jwt({ token, account }) {
			if (account) {
				token.userId = `${account.provider}:${account.providerAccountId}`;
			}
			return token;
		},
		session({ session, token }) {
			if (token.userId) {
				session.user.id = token.userId as string;
			}
			return session;
		},
	},
});
