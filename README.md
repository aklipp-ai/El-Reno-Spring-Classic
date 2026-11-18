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

There is no build step and no dependencies. Every file is plain HTML, CSS, and JavaScript.

## Deploying on Render

1. Sign in at render.com and choose **New**, then **Static Site**.
2. Connect the repository or choose the option to upload, then point Render at this folder.
3. Set these values:
   - **Build Command:** leave empty
   - **Publish Directory:** `.` if the files sit at the repository root, or the folder name if you keep them in a subfolder
4. Click **Create Static Site**.

Render serves `index.html` at the root, so the public page is your main URL and the editor is at `/admin.html`.

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
