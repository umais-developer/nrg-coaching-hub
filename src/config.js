export const APP_CONFIG = {
  CLIENT_ID: "Ov23liqDSLiDmto37wNQ",
  TOKEN_EXCHANGE_URL: "https://umaisdeveloper--87af7930539211f1953dee650bb23af1.web.val.run",
  TARGET_REPO: "umais-developer/nrg-coaching-hub",
  TARGET_BRANCH: "main",
  OAUTH_SCOPE: "public_repo",
  OAUTH_CALLBACK_PATH: "/login.html",

  // Encrypt coaching note bodies via the Val Town function.
  //
  // Defaults to FALSE so this build changes nothing until the val is deployed
  // with NOTE_ENCRYPTION_KEY and TARGET_REPO set. Flip to true only after the
  // val's /encrypt and /decrypt routes are live — turning it on beforehand
  // makes note saving fail (deliberately: it must never silently fall back to
  // writing plaintext).
  //
  // NOTE: no key here. The key lives only in Val Town env. Anything in this
  // file ships in a public bundle and is writable via window.APP_CONFIG.
  NOTE_ENCRYPTION: false,

  ...(window.APP_CONFIG || {})
};
