import { authProviderConfigured, signIn } from "@/auth";

export default function SignInPage() {
  return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">PP</div><p className="eyebrow">PANTRY PAL</p><h1>Shop together.<br /><em>Remember everything.</em></h1><p className="muted">Your shared grocery companion for the market, the pantry, and everywhere in between.</p>{authProviderConfigured ? <form action={async () => { "use server"; await signIn("oidc", { redirectTo: "/lists" }); }}><button className="primary-button full" type="submit">Continue with your account <span>→</span></button></form> : <div className="notice">OIDC is not fully configured. Set <code>OIDC_USERINFO_URL</code> to your Cognito domain’s <code>/oauth2/userInfo</code> endpoint, then restart the server.</div>}<p className="fine-print">Private by default · Shared with your household</p></div></main>;
}
