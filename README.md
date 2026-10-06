# Iris Outpost — Mobile PWA

A tiny, offline-friendly mobile version of Iris Outpost.

## Music

The app does **not** contain or upload your music. On the phone, tap **+ ADD MP3s** or **+ ADD FOLDER** and select your local audio files. They are played directly from the device in the browser.

## Install on Android

1. Put this folder on a web server using HTTPS (for example GitHub Pages, Cloudflare Pages, or any small static host).
2. Open the HTTPS address in Chrome on the phone.
3. Choose **Add to Home screen / Install app**.
4. Open Iris Outpost from the new icon.
5. Select your MP3s with **+ ADD MP3s**.

The HTML/CSS/JS and Iris images are cached for offline use after the first visit. Music files remain on the phone and are not copied into the app.

## Local desktop test

    python3 -m http.server 8000

Then open http://localhost:8000/ .

## Notes

- No Python, Node, Ollama or backend is required by the app itself.
- The service worker needs HTTPS (or localhost) to work.
- Browser support for selecting an entire folder varies; selecting multiple MP3 files is the reliable fallback.
