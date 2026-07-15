# Ascent — deploy your own job-hunt platform

This is the full Ascent app (resume builder, job tracker, AI match scoring,
cover letter generator) as a real, deployable website — not just something
that lives inside a Claude chat.

## What changed from the in-Claude version

- **Storage**: uses your browser's `localStorage` instead of Claude's
  account storage. Your data lives on whichever device/browser you use the
  site from. (See "Going further" below if you want it synced across devices.)
- **AI calls**: go through a secure serverless function (`/pages/api/claude.js`)
  that runs on Vercel's servers, not your browser — so your API key is never
  exposed to anyone visiting your site.

## What you'll need

- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account (sign up with your GitHub account — one click)
- An [Anthropic API key](https://console.anthropic.com/settings/keys) — this is
  a **different account/key** than your claude.ai login. You'll need to add a
  small amount of billing credit ($5 goes a long way for personal use) at
  console.anthropic.com.
- [Node.js](https://nodejs.org) installed on your computer (only needed if you
  want to test locally before deploying — optional but recommended)

## Step 1 — Get the code onto GitHub

1. Unzip this project somewhere on your computer.
2. Go to [github.com/new](https://github.com/new), create a new repository
   (call it `ascent` or anything you like), keep it **private** if you'd
   rather not show it publicly.
3. Follow GitHub's instructions on that page under "…or push an existing
   repository from the command line" — it'll look like:
   ```
   cd path/to/unzipped/ascent-web
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ascent.git
   git push -u origin main
   ```
   (If you've never used git before, GitHub Desktop — a free app — does all
   of this with buttons instead of commands: https://desktop.github.com)

## Step 2 — (Optional but recommended) Test it locally first

```
cd ascent-web
npm install
cp .env.example .env.local
```
Open `.env.local` and paste in your real Anthropic API key. Then:
```
npm run dev
```
Open **http://localhost:3000** — you should see the full app. Try adding a
resume field or a job to confirm it saves (refresh the page — it should still be there).

## Step 3 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Click **Import** next to the `ascent` repository you just pushed.
3. Vercel will auto-detect it's a Next.js app — you don't need to change any
   build settings.
4. Before clicking Deploy, expand **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your real key from console.anthropic.com
5. Click **Deploy**. In about a minute, you'll get a live URL like
   `ascent-yourname.vercel.app` — that's your working site.

## Step 4 — Add your own domain (optional)

1. Buy a domain anywhere (Namecheap, Google Domains, etc.) if you don't have one.
2. In your Vercel project, go to **Settings → Domains**, add your domain.
3. Vercel shows you 1–2 DNS records to add at your domain registrar. Add
   those, wait a few minutes to a few hours for DNS to propagate, and your
   domain will point at your Ascent app.

## Making changes later

Any time you want to tweak the app, edit the files (mainly
`components/AscentApp.jsx`), then:
```
git add .
git commit -m "describe your change"
git push
```
Vercel automatically redeploys within about a minute of every push — no
extra steps.

## Resume upload

You can upload `.pdf`, `.docx`, or `.txt` resumes directly — PDF text
extraction happens server-side (`/api/parse-pdf`), so no API key or extra
setup is needed for it. Scanned/image-only PDFs (no selectable text) can't be
read this way — copy-paste the text instead for those.

## Going further

- **Cross-device sync**: right now data is per-browser (localStorage). To
  make it available from your phone and laptop both, you'd add a real
  database — Vercel Postgres or Supabase are the easiest free options — and
  swap out the two functions `loadKey`/`saveKey` near the top of
  `AscentApp.jsx` to call a new `/api/data` route instead of `localStorage`.
  Everything else in the app stays the same.
- **Login/accounts**: only needed if more than one person will use the same
  deployed site and you want to keep their data separate. Libraries like
  [Clerk](https://clerk.com) or [NextAuth](https://next-auth.js.org) are the
  standard, fairly quick way to add this to a Next.js app.
- **Costs**: Vercel's free tier comfortably covers personal use. The only
  ongoing cost is Anthropic API usage, which is pay-as-you-go and typically
  very cheap for this kind of usage (a few cents per resume parse / match
  analysis / cover letter).

## Project structure

```
ascent-web/
├── pages/
│   ├── index.js          the page that renders the app
│   ├── _app.js           Next.js boilerplate wrapper
│   └── api/
│       └── claude.js     secure server-side AI proxy (keeps your API key hidden)
├── components/
│   └── AscentApp.jsx     the entire app — resume builder, tracker, AI features
├── package.json
├── next.config.js
├── .env.example           copy to .env.local for local dev
└── .gitignore
```
