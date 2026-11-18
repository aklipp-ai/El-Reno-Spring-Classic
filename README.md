# 2027 El Reno Spring Classic

Static site for the 2027 El Reno Spring Classic, February 13, 2027 at El Reno High School.

## What is in this folder

| File | Purpose |
| --- | --- |
| `index.html` | Public schedule page. This is the page you share with teams. |
| `admin.html` | Admin editor. Password protected. |
| `styles.css` | All styling for both pages and all printouts. |
| `public.js` | Logic for the public page, filters, and print buttons. |
| `admin.js` | Logic for the admin editor, drag and drop, officials, publishing. |
| `schedule-data.js` | Helper library plus the built in fallback schedule. |
| `published-data.js` | The live schedule. This is the file the site actually displays. |
| `crest.png` | Full size team crest. |
| `crest-sm.png` | Small crest used in the footer and print headers. |
| `favicon.png` | Browser tab icon. |
| `package.json` | Node project file with a start script. Needed only for the Web Service route. |
| `server.js` | Tiny dependency free static server. Needed only for the Web Service route. |

There is no build step and no dependencies. Every file is plain HTML, CSS, and JavaScript. The bundle works as either a Render Static Site or a Render Web Service.

## Deploying on Render

You have two options. Option A is simpler and is the recommended one.

### Option A: Static Site (recommended)

1. Sign in at render.com and choose **New**, then **Static Site**.
2. Connect the repository or choose the option to upload, then point Render at this folder.
3. Set these values:
   - **Build Command:** leave empty
   - **Publish Directory:** `.` if the files sit at the repository root, or the folder name if you keep them in a subfolder
4. Click **Create Static Site**.

No `package.json` is required for this route. Render serves `index.html` at the root, so the public page is your main URL and the editor is at `/admin.html`.

### Option B: Web Service (Node)

Use this only if you specifically want a Node service. The included `package.json` and `server.js` handle it with no dependencies.

1. Choose **New**, then **Web Service**.
2. Point Render at this folder.
3. Set these values:
   - **Runtime:** Node
   - **Build Command:** `npm install` or leave empty
   - **Start Command:** `npm start`
4. Click **Create Web Service**.

The server listens on `process.env.PORT`, which Render sets for you, and serves the same files. It falls back to port 10000 when run locally.

Do not set both up for the same repository. Pick one route and use it.

## Admin password

The default is `elreno`. You can change it in the admin under **Settings**. The password is stored in the browser, not on the server, so it keeps casual visitors out of the editor but it is not server side security. If you change it, the change applies only to the browser where you made it.

## Updating the schedule

1. Open `/admin.html` and unlock with the password.
2. Make your edits on the Schedule, Teams, or Officials tabs.
3. Go to the **Publish** tab and click **Download publish file**.
4. Replace `published-data.js` in this folder with the downloaded file.
5. Commit and push. Render redeploys automatically.

## Printouts

Every printout is sized for letter paper. The board grid prints landscape, and the team and field lists print portrait. Use the print buttons on the public page or in the admin Print tab.
