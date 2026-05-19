# NRG Coaching Website (GitHub Pages)

This folder now includes a multi-page coaching website that can run on GitHub Pages and save discussion artifacts into your repository.

## Included pages

- `index.html`: landing page linking all coaching workflows and existing workshop/roster pages.
- `teams-roster.html`: your existing roster page.
- `workshop-sessions-1A-US.html`: your existing workshop sessions page.
- `login.html`: GitHub OAuth sign-in page.
- `coach-notes.html`: choose member + meeting date + notes, save as unique `.txt` in repo.
- `discussions.html`: pull and preview saved discussion notes from repo.
- `uploads.html`: upload ad-hoc files into each member folder.

## Repo file organization used by the app

- `members/<member-slug>/notes/<meeting-date>_<timestamp>.txt`
- `members/<member-slug>/uploads/<timestamp>_<filename>`

## One-time setup

1. Register GitHub OAuth app at https://github.com/settings/developers.
2. Set Homepage URL and Authorization callback URL to your login page URL.
3. Deploy the token-exchange function.
   - A Val Town starter is included in `token-exchange-valtown.ts`.
4. Edit `assets/js/config.js` and set:
   - `CLIENT_ID`
   - `TOKEN_EXCHANGE_URL`
   - `TARGET_REPO` (format: `owner/repo`)
   - `TARGET_BRANCH`
   - `OAUTH_SCOPE` (`repo` for private repos, `public_repo` for public-only)
   - `OAUTH_CALLBACK_PATH` (for this Pages deployment: `/login.html`)

## Deploy on GitHub Pages

1. Push this folder to your repository.
2. In repository settings, enable Pages from `main` branch and root folder.
3. Open your Pages URL root.
4. Go to login page and sign in.

## Notes

- Use `repo` scope only if needed.
- The note save creates unique file names by date + timestamp.
- Discussions page reads all note files by scanning the repository tree.
- Upload page stores files in per-member upload folders.
