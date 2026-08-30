import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const configuredDomain = process.env.COGNITO_DOMAIN?.replace(/\/$/, "");
  const userInfoUrl = process.env.OIDC_USERINFO_URL?.replace(/\/oauth2\/userInfo\/?$/, "");
  const domain = configuredDomain || userInfoUrl;
  const clientId = process.env.OIDC_CLIENT_ID;
  const appUrl = process.env.AUTH_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const logoutUri = `${appUrl}/signin`;

  if (!domain || !clientId) {
    return NextResponse.json({ url: logoutUri });
  }

  const logoutUrl = new URL(`${domain}/logout`);
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("logout_uri", logoutUri);
  return NextResponse.json({ url: logoutUrl.toString() });
}
