# Enabling note encryption — step by step

**Nothing changes until all three steps are done.** Today the app saves notes in
plaintext exactly as it always has. `NOTE_ENCRYPTION` ships as `false`, and that
flag gates exactly one thing: whether Coach Notes calls the encrypt route.

You will notice one cosmetic difference already — the Coach Notes page shows an
amber line saying notes are not encrypted. That is deliberate honesty, not a bug.
It turns green once step 3 is done.

---

## Step 1 — Generate a key and back it up

Run this locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

You get something like `eolPqg63Mfb+UBVen63HgDa/PL0kk7sw/phOZUrIxvM=` — 32 bytes,
base64.

**Put it in a password manager before doing anything else.**

- If you lose this key after encrypting notes, **those notes are gone forever**.
  There is no reset, no recovery, no way to derive it. That is what makes the
  encryption real.
- Never commit it, never paste it into `src/config.js`, never put it in a GitHub
  Actions secret. Vite inlines build-time values into `dist/assets/*.js`
  verbatim, which publishes them.
- Generate it yourself rather than reusing a key that has appeared in a chat log
  or terminal scrollback.

---

## Step 2 — Deploy the updated Val Town function

This is the only step that cannot be done from this repo — Val Town deploys from
its own dashboard.

1. Open your val:
   https://umaisdeveloper--87af7930539211f1953dee650bb23af1.web.val.run
   (or find it in the Val Town dashboard)

2. Replace its entire contents with
   [`serverless/token-exchange-valtown.ts`](../serverless/token-exchange-valtown.ts).

   The OAuth token-exchange route is **unchanged** and stays the default route,
   so pasting this will not break sign-in.

3. Set environment variables. Two already exist; two are new:

   | Variable | Value | Status |
   |---|---|---|
   | `GITHUB_CLIENT_ID` | *(unchanged)* | already set |
   | `GITHUB_CLIENT_SECRET` | *(unchanged)* | already set |
   | `ALLOWED_ORIGIN` | `https://nrg.umaissiddiqui.com` | already set |
   | `NOTE_ENCRYPTION_KEY` | the base64 key from step 1 | **NEW** |
   | `TARGET_REPO` | `umais-developer/nrg-coaching-hub` | **NEW** |

4. Save/deploy the val.

### Confirm step 2 worked

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{}' \
  https://umaisdeveloper--87af7930539211f1953dee650bb23af1.web.val.run/encrypt
```

| Response | Meaning |
|---|---|
| `{"error":"Missing code or redirect_uri"}` | ❌ Old code still deployed — the val is treating `/encrypt` as the OAuth route |
| `{"error":"Missing token"}` | ✅ New code is live and correctly refusing an unauthenticated caller |
| `{"error":"NOTE_ENCRYPTION_KEY is not configured"}` | ⚠️ New code is live but the key env var is missing |
| `{"error":"TARGET_REPO is not configured"}` | ⚠️ New code is live but `TARGET_REPO` is missing |

Also confirm sign-in still works before continuing — open the app and log out
and back in.

---

## Step 3 — Turn it on

In [`src/config.js`](../src/config.js), line 19:

```js
NOTE_ENCRYPTION: false,   ->   NOTE_ENCRYPTION: true,
```

Commit and push. GitHub Actions redeploys automatically (about a minute).

**Do not do this before step 2.** If the flag is on and the val is not ready,
saving a note **fails with an error** rather than silently writing plaintext to
a public repo. That failure is intentional.

Want to test without deploying? Open the browser console on the live site and run
`window.APP_CONFIG = { NOTE_ENCRYPTION: true }` **before** the page loads, or
just run `npm run dev` locally with the flag flipped.

---

## Verify it end to end

1. Save a new note with some recognizable text.
2. Find the file on github.com under
   `coaches/umais-developer/members/<slug>/notes/`.
   Headers should be readable; the body should be base64 gibberish, and the
   header block should include `Encryption: v1`.
3. Open the note in the app's Discussions page — it should read normally.
4. Confirm your 5 **existing** notes still display (they have no `Encryption:`
   header, so no decryption is attempted).
5. Confirm the roster, cohorts, workshops, and admin pages all still load —
   proof that `teams.json` was not caught by the note crypto path.

### The adversarial checks — these are the point

```bash
VAL=https://umaisdeveloper--87af7930539211f1953dee650bb23af1.web.val.run

# No token -> 401. CORS does not protect this; only the token check does.
curl -s -X POST -H "Content-Type: application/json" \
  -H "Origin: https://evil.example.com" \
  -d '{"path":"coaches/umais-developer/members/aaron-medina/notes/x.txt"}' \
  $VAL/decrypt

# Traversal -> 403
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"token":"<your gh token>","path":"coaches/umais-developer/../../etc/passwd"}' \
  $VAL/decrypt
```

And the one that matters most, in the app: sign in as a **linked team member**
and try to open a note about yourself marked `Visibility: private`. The val must
refuse it (403) even though the note is legitimately about you.

Finally, after any build:

```bash
grep -ri "NOTE_ENCRYPTION_KEY" dist/     # must return nothing
grep -r "<your key>" dist/               # must return nothing
```

---

## Turning it back off

Set `NOTE_ENCRYPTION: false` and redeploy. New notes save as plaintext again;
already-encrypted notes **still decrypt normally**, because decryption keys off
each note's own `Encryption:` header rather than the flag. Keep the key in Val
Town regardless — removing it makes existing encrypted notes unreadable.

---

## What this does not hide

Worth re-reading before you rely on it:

| Still public | Example |
|---|---|
| File paths | `coaches/umais-developer/members/aaron-medina/notes/2026-08-12_*.txt` |
| Commit messages | `Add coaching note for Aaron Medina on 2026-08-12` |
| Note headers | member name, team, cohort, date, visibility |
| `teams.json` | every member's name, position, location, AI-knowledge rating |

*What was said* becomes private. *That a session happened, with whom, and when*
stays public. A private repository is the broader fix and covers all of the
above; the two are complementary.
