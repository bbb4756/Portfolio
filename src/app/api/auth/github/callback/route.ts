import { NextResponse } from "next/server";
import { consumeOauthState, setAdminSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = await consumeOauthState();
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!code || !state || !stored || state !== stored.state || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin?auth=invalid", url.origin));
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/auth/github/callback`,
      code_verifier: stored.verifier,
    }),
  });
  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) return NextResponse.redirect(new URL("/admin?auth=exchange", url.origin));

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenData.access_token}`,
    "X-GitHub-Api-Version": "2026-03-10",
  };
  const userResponse = await fetch("https://api.github.com/user", { headers });
  const user = await userResponse.json() as { id?: number; login?: string };
  const allowedLogin = process.env.CMS_ADMIN_GITHUB_LOGIN;
  const allowedUserId = Number(process.env.CMS_ADMIN_GITHUB_ID);
  const repo = process.env.CMS_GITHUB_REPO;
  if (
    !user.id || !user.login || !allowedLogin || !Number.isSafeInteger(allowedUserId) ||
    user.id !== allowedUserId || user.login.toLowerCase() !== allowedLogin.toLowerCase() || !repo
  ) {
    return NextResponse.redirect(new URL("/admin?auth=forbidden", url.origin));
  }
  const permissionResponse = await fetch(`https://api.github.com/repos/${repo}/collaborators/${user.login}/permission`, { headers });
  const permission = await permissionResponse.json() as { permission?: string };
  if (!permissionResponse.ok || !["admin", "maintain", "write"].includes(permission.permission ?? "")) {
    return NextResponse.redirect(new URL("/admin?auth=permission", url.origin));
  }
  await setAdminSession({ login: user.login, githubUserId: user.id, token: tokenData.access_token });
  return NextResponse.redirect(new URL("/admin", url.origin));
}
