# Only Us ❤️

A romantic, responsive surprise website for Salema, built with HTML, CSS, and vanilla JavaScript. It has no build step. GitHub Pages serves the static site; Firebase Authentication, Firestore, and Storage are used for sign-in and protected media.

> **Privacy:** GitHub Pages serves `index.html`, JavaScript, styles, and other repository files publicly. The sign-in flow does not make text embedded in those files private. Do not put passwords, service-account keys, private keys, or confidential text in this repository.

## Run locally

Serve this folder from a local web server such as `localhost` to test Firebase sign-in. The pink sign-in screen opens on load. Firebase requires `localhost` or HTTPS; `file://` is not a supported Firebase origin. Without the web app configuration, sign-in remains disabled and the screen explains what is missing. Google Fonts load when online and fall back to system fonts offline.

## GitHub Pages deployment

### 1. Configure Firebase

`firebase.js` reads `window.ONLY_US_FIREBASE_CONFIG` and initializes Firebase Authentication, Firestore, and Storage from it. This project does not currently contain those project-specific values. Create a Firebase project, register a **Web app**, then add the configuration from Firebase Project settings to `index.html` in the `<head>`, immediately before the deferred `firebase.js` script:

```html
<script>
  window.ONLY_US_FIREBASE_CONFIG = {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_FIREBASE_WEB_APP_ID",
    storageBucket: "YOUR_STORAGE_BUCKET"
  };
</script>
<script defer src="firebase.js"></script>
```

Use the exact values from Firebase Project settings, including the bucket name. Firebase web-app configuration is public client configuration, not an admin credential. Never put service-account JSON, private keys, or admin credentials in frontend files or GitHub.

Enable **Email/Password** in **Firebase Console → Authentication → Sign-in method**, then create the two permitted accounts. Do not enable public account creation for this site.

#### Authorize the GitHub Pages domain

In **Firebase Console → Authentication → Settings → Authorized domains**, add the hostname serving the site:

- For `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`, add `YOUR-USERNAME.github.io`.
- If using a custom domain, add its hostname too (for example, `surprise.example.com`). Add both the apex and `www` hostnames if the site will use both.

Enter only the hostname: no `https://`, path, or trailing slash. Keep `authDomain` set to the Firebase-provided value unless you separately configure a Firebase custom auth domain.

#### Publish restrictive Firestore and Storage rules

1. Copy the two account UIDs from **Authentication → Users**.
2. In **Firestore Database → Rules**, paste the contents of `firebase.rules`. Replace both `REPLACE_WITH_OWNER_UID` and `REPLACE_WITH_SALEMA_UID` with those exact UIDs, then **Publish**.
3. In **Storage → Rules**, paste the contents of `storage.rules`. Replace the same two placeholders with the same UIDs, then **Publish**.
4. Keep the placeholder versions in this repository. If the repository is public, do not commit your project-specific UID allowlists. UIDs are identifiers, not passwords, but there is no need to publish them.

The rules deny access by default. Firestore only allows the listed accounts to read documents in `/private/`; writes are denied. The app checks `/private/{uid}` before opening a private section. Binary media remains in Firebase Storage; use `/private/` for private Firestore documents. Storage only allows the listed accounts to read or replace the named private photos and voice note, subject to file type and size limits. The site uses these Firebase Storage object paths:

- `private/photos/celebration.jpg`
- `private/photos/wedding-bouquet.jpg`
- `private/photos/golden-hour.jpg`
- `private/photos/love-sign.jpg`
- `voice-notes/private/voice-note`

Upload your own media to those paths after publishing the Storage rules. Photos must be JPEG, PNG, or WebP up to 15 MB each. Voice notes must be audio files up to 25 MB. The music player uses an MP3 selected locally by the visitor; it does not upload that song.

### 2. Upload the project to GitHub

Create an empty **public** repository on GitHub (for example, `only-us-surprise`). The Pages site is public, so keep confidential content out of the repository. From PowerShell, run these commands from the project folder. Replace the GitHub username and repository name in the remote URL:

```powershell
cd "C:\Users\Rakhiibul\OneDrive\Desktop\RS"
git init
git branch -M main
git add index.html style.css app.js firebase.js firebase.rules storage.rules README.md assets
git commit -m "Prepare Only Us for GitHub Pages"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If Git reports that a remote named `origin` already exists, inspect it with `git remote -v` and update it with `git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git`.

Keep the folder structure intact: `index.html` and the CSS/JavaScript files belong at the repository root, and the sample images belong under `assets/memories/`. The page references `style.css`, `firebase.js`, and `app.js` with relative paths, so the same `index.html` works at the root of a project Pages URL without a `<base>` element or hard-coded domain path. Firebase Storage paths are object names, not local web asset URLs.

### 3. Enable GitHub Pages

1. Open the repository on GitHub and select **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/(root)`**, then select **Save**.
4. Wait for the Pages deployment to finish. Open the URL shown on the Pages settings screen; for a project site it is usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
5. In Pages settings, enable **Enforce HTTPS** once it is available.

If the repository is named exactly `YOUR-USERNAME.github.io`, GitHub uses the root URL `https://YOUR-USERNAME.github.io/` instead of the project-site URL shown above.

### Final deployment checklist

- [ ] `index.html`, `style.css`, `app.js`, and `firebase.js` are at the repository root; `assets/memories/` is present.
- [ ] The web-app configuration in `index.html` matches the Firebase project and contains no admin credentials or private keys.
- [ ] The Pages hostname (and any custom hostname) is listed in Firebase Authentication's authorized domains.
- [ ] Email/Password is enabled and only the intended two accounts have been created.
- [ ] Both Firebase rule sets have the correct two UIDs in the Firebase Console and have been published; the repository copies still contain placeholders.
- [ ] Your private media is uploaded to the exact Storage paths listed above.
- [ ] GitHub Pages is deploying `main` from `/(root)`, and the published URL uses HTTPS.
- [ ] The published page loads its styles and scripts, and sign-in, protected media, and sign-out have been tested on the published domain.
- [ ] No confidential content is assumed private if it is embedded in the static HTML or JavaScript.

## Personalize the experience

Edit the copy in `index.html` and the six short notes in `app.js`. Each letter sentence is a separate `.letter-line` paragraph in `index.html`. Edit the `questions` array and `finalQuestionSurprise` in `app.js` to customize the interactive questions and answers.

The gallery loads photos from authenticated Firebase Storage paths; it does not display the local sample images automatically. Replace the sample images in Storage with your own private photos. The music player does not bundle a song: choose an MP3 you have the right to use, then press Play. Mobile browsers may require a direct tap before audio begins.

The section navigation is gated in the app, but static text in `index.html` and `app.js` is downloadable by anyone who can reach the site. Put information that must remain confidential in Firebase under `/private/` and fetch it only after authorization. The favorite button's local-storage value is only a display preference, never an authentication mechanism.

## Test sign-in

1. Add your Firebase web app configuration as described above, enable **Email/Password**, and publish the Firestore and Storage rules with the two account UIDs.
2. Serve the folder over HTTP on `localhost` (Firebase does not support `file://`), then open the page. The pink sign-in screen should open automatically.
3. Sign in with each authorized account. The private experience should open; try the gallery and voice note if you have uploaded those files.
4. Select **Sign out**. Private navigation should return to the sign-in screen. Sign back in with the other authorized account and repeat.
5. If you have a separate, non-authorized Firebase account, verify that authentication may succeed but the private-section check is denied and the site remains on the public home page.
6. Reloading signs you out because the app deliberately uses Firebase's in-memory auth persistence; this avoids using browser storage as the authentication mechanism.

Useful errors are shown in the sign-in screen for invalid credentials, network issues, disabled Email/Password sign-in, and rejected access. A Firebase Web app configuration is required; do not substitute service-account credentials or passwords.
