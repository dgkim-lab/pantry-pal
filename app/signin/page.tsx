import { authProviderConfigured, signIn } from "@/auth";
import { Button, Paper, Typography } from "@mui/material";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/lists";
  return (
    <main className="auth-shell">
      <Paper className="auth-card" elevation={0} sx={{ bgcolor: "transparent" }}>
        <div className="brand-mark">PP</div>
        <p className="eyebrow">PANTRY PAL</p>
        <Typography component="h1" variant="h1">
          Shop together.<br />
          <em>Remember everything.</em>
        </Typography>
        <p className="muted">
          Your shared grocery companion for the market, the pantry, and everywhere in between.
        </p>
        {authProviderConfigured ? (
          <form action={async () => {
            "use server";
            await signIn("oidc", { redirectTo });
          }}>
            <Button className="full" variant="contained" size="large" type="submit">
              Continue with your account <span>→</span>
            </Button>
          </form>
        ) : (
          <div className="notice">
            OIDC is not fully configured. Set <code>OIDC_USERINFO_URL</code> to your Cognito
            domain’s <code>/oauth2/userInfo</code> endpoint, then restart the server.
          </div>
        )}
        <p className="fine-print">Private by default · Shared with your household</p>
      </Paper>
    </main>
  );
}
