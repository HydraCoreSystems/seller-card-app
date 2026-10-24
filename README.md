# Seller Card App

Working title. A light phone app for Facebook plant sellers: save a profile once, keep a simple
plant list, and get finished listing cards and stamped photos ready to paste. The app never posts
to Facebook.

This is **test build one**: everything runs on the phone, with no sign in and no subscription yet.

## What's in it

* **Seller profile**, saved once: name, seller number, shipping, payment, time zone, claim rules.
* **Plant list** (home screen): name with a NOID switch, price, set price or auction, photo, notes.
* **Sale builder in two layers**: the announcement, built once per sale from the profile plus a few
  sale settings, and the lean listing per lot (lot number, name, price or opening bid, a few words).
* **Purge mode**: pick plants, get the announcement and every numbered lot in one pass, then step
  through them with Copy and Next.
* **Photo stamp**: seller name, seller number and date along the bottom edge of a copy of the photo,
  plus the origin line. The original is never changed.
* **Claim tracker**: paste the comment thread, get claims per lot in thread order. Times are hints
  only. Claims that thread order can't separate are marked as ties for the seller to rule on.
* **Sales record**: searchable, exports a CSV file.
* **Origin line** on every card and stamped photo.

## Getting the test build

Every push to `main` builds an Android APK and publishes it to the
[test build release](../../releases/tag/test-build). Open that page on the phone, download the
`.apk`, and install it.

## Code map

* `src/core/` holds plain TypeScript with no app dependencies: formats, claim reading, lot numbering,
  stamp layout, the sales record export. It's shared with the free web card maker later.
* `src/core/formats/` has one file per posting format. A format pack is a new file registered in
  `formats/index.ts`. Every format has both layers.
* `src/core/brand.ts` holds the app name and the origin line. The product name is still open; change
  it there.
* `src/app/` holds the screens (Expo Router). `src/lib/` holds storage, photos and stamping, with
  `.web.ts` versions for trying the app in a browser.

## Working on it

```bash
npm install
npm test             # core checks
npm run typecheck
npx expo start       # needs a development build for the camera and photo stamp
npx expo export -p web   # browser build for a quick look
```

House style for anything a member reads (app copy, card text, store text): plain words,
contractions welcome, and no dashes of any kind. A test checks every format for dashes.
