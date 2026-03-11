import type { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { findActiveUserIdByKakaoId, upsertUserFromKakao } from "@/features/auth/server";

async function fetchKakaoNickname(accessToken?: string | null) {
  if (!accessToken) return null;

  try {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      kakao_account?: { profile?: { nickname?: string } };
      properties?: { nickname?: string };
    };

    return (
      payload.kakao_account?.profile?.nickname?.trim() ||
      payload.properties?.nickname?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

function parseKakaoProfileNickname(profile: unknown) {
  const p = profile as {
    kakao_account?: { profile?: { nickname?: string } };
    properties?: { nickname?: string };
  } | null;

  return (
    p?.kakao_account?.profile?.nickname?.trim() ||
    p?.properties?.nickname?.trim() ||
    null
  );
}

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "kakao") return false;

      const kakaoId = account.providerAccountId;
      if (!kakaoId) {
        return false;
      }

      const nicknameFromProfile = parseKakaoProfileNickname(profile);
      const kakaoNickname = await fetchKakaoNickname(
        typeof account.access_token === "string" ? account.access_token : null
      );
      const providerName = user.name?.trim() || null;
      const sanitizedProviderName =
        providerName && !providerName.startsWith("카카오사용자-")
          ? providerName
          : null;
      const fallbackName = `카카오사용자-${kakaoId.slice(-6)}`;
      const name =
        nicknameFromProfile || kakaoNickname || sanitizedProviderName || fallbackName;

      if (process.env.NODE_ENV !== "production") {
        console.log("[auth:kakao] nickname resolution", {
          hasAccessToken: Boolean(account.access_token),
          nicknameFromProfile,
          kakaoNickname,
          providerName,
          finalName: name,
        });
      }

      await upsertUserFromKakao({
        kakaoId,
        name,
        email: user.email ?? null,
        imageUrl: user.image ?? null,
      });

      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "kakao" && account.providerAccountId) {
        const userId = await findActiveUserIdByKakaoId(account.providerAccountId);
        if (userId) token.uid = userId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === "string" ? token.uid : "";
      }
      return session;
    },
  },
};
