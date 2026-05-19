import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  completeOAuthIfNeeded,
  fetchCurrentUser,
  getConfig,
  getToken,
  logout,
  startSignIn
} from "../lib/githubAuth";

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Ready to sign in.");
  const [statusOk, setStatusOk] = useState(false);
  const [whoami, setWhoami] = useState("Not signed in.");

  useEffect(() => {
    const cfg = getConfig();
    if (cfg.missing.length) {
      setStatus(`Missing config values: ${cfg.missing.join(", ")}`);
      setStatusOk(false);
      return;
    }

    const run = async () => {
      try {
        const oauthResult = await completeOAuthIfNeeded(location.search);
        if (oauthResult.changed) {
          setStatus("Login successful. Redirecting...");
          setStatusOk(true);
          navigate(oauthResult.target, { replace: true });
          return;
        }
      } catch (error) {
        setStatus(`Sign-in callback failed: ${error.message}`);
        setStatusOk(false);
      }

      if (!getToken()) {
        setWhoami("Not signed in.");
        return;
      }

      try {
        const user = await fetchCurrentUser();
        setWhoami(`Signed in as ${user.login}`);
      } catch (error) {
        setWhoami(`Unable to read user profile: ${error.message}`);
      }
    };

    run();
  }, [location.search, navigate]);

  return (
    <div className="row justify-content-center animate-in">
      <div className="col-md-8 col-lg-6">
        <div className="page-header ph-slate mb-3">
          <div className="page-header-eyebrow">Authentication</div>
          <h1 style={{ fontSize: "2rem" }}>Sign In</h1>
          <p className="text-secondary mb-0">Authenticate with GitHub to save coaching notes and upload files to the repository.</p>
        </div>

        <div className="section-card p-4">
          <div className={`alert ${statusOk ? "alert-success" : "alert-warning"} py-2 mb-4`}>{status}</div>

          <div className="d-flex flex-wrap gap-2 mb-4">
            <button
              className="btn btn-dark"
              type="button"
              onClick={() => {
                try { startSignIn("/coach-notes"); }
                catch (error) { setStatus(error.message); setStatusOk(false); }
              }}
            >
              ⚡ Sign In With GitHub
            </button>
            <button
              className="btn btn-outline-dark"
              type="button"
              onClick={() => { logout(); setStatus("Signed out."); setStatusOk(true); setWhoami("Not signed in."); }}
            >
              Sign Out
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
            <p className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-500)" }}>{whoami}</p>
          </div>
        </div>

        <div className="section-card p-3 mt-3" style={{ fontSize: "0.82rem", color: "var(--ink-500)" }}>
          <p className="mb-1"><strong style={{ color: "var(--ink-800)" }}>Access control:</strong> Only repo collaborators can sign in.</p>
          <p className="mb-0 mono" style={{ fontSize: "0.7rem" }}>Token stored in sessionStorage — cleared on tab close.</p>
        </div>
      </div>
    </div>
  );
}
