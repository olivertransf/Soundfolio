# Using Spotify Stats inside Obsidian

This app is a **Next.js website** (runs in a browser). Obsidian does not execute your app’s code directly, but you can **surface the same UI** in a few ways.

## 1. Embed the deployed site (simplest)

After you deploy to Vercel, install a community plugin that loads external URLs in a pane:

| Approach | Notes |
|----------|--------|
| [**Custom Frames**](https://obsidian.md/plugins?id=obsidian-custom-frames) | Add a frame pointed at `https://your-domain.com/me` (or `/me?range=ytd`). Good for daily use. |
| **Web viewer / iframe-style plugins** | Search Community Plugins for “iframe”, “web viewer”, or “browser”. |

**Requirements:** Your site must be served over **HTTPS** (production). Local `localhost` often works only on the same machine and may be blocked inside Obsidian’s webview depending on the plugin.

## 2. Deep links from notes (no plugin)

Put links in Markdown:

```markdown
[Open Spotify Stats](https://your-domain.com/me?range=ytd)
```

Opens in the system browser. Use `range=ytd` for **This year** (same as the app default).

## 3. Building a dedicated Obsidian plugin

Possible, but heavy: an Obsidian plugin would mostly **wrap a webview** or **open URLs**—similar to Custom Frames. Reimplementing charts/stats inside Obsidian would duplicate this repo. Prefer embedding unless you need offline-only behavior.

## 4. Data in Obsidian without the website

If the goal is **notes** (e.g. “top tracks this month” in a note), you could add a small script or API in this repo that exports Markdown/JSON and run it on a schedule—not the full interactive UI.

---

**Summary:** For “integrate our website into Obsidian,” use **Custom Frames** (or similar) + your **production URL**, or **markdown links** to the same URL.
