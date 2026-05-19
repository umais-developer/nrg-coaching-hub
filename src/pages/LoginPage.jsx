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
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">GitHub Login</h1>
      <p className={`alert ${statusOk ? "alert-success" : "alert-warning"} py-2`}>{status}</p>
      <div className="d-flex flex-wrap gap-2">
        <button
          className="btn btn-dark"
          type="button"
          onClick={() => {
            try {
              startSignIn("/coach-notes");
            } catch (error) {
              setStatus(error.message);
              setStatusOk(false);
            }
          }}
        >
          Sign In With GitHub
        </button>
        <button
          className="btn btn-outline-dark"
          type="button"
          onClick={() => {
            logout();
            setStatus("Signed out.");
            setStatusOk(true);
            setWhoami("Not signed in.");
          }}
        >
          Sign Out
        </button>
      </div>
      <div className="mono small text-secondary mt-3">{whoami}</div>
    </section>
  );
}
