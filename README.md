# Skrybix

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
* **Claim tracker**: paste the comment thread, get claims per lot in the order they arrived. The first
  claim wins and later claims are alternates in the same order. There is no tie state and no seller
  pick: two claims in the same minute still fall in the order they arrived.
* **After the showcase**: the rundown of winners by lot with the next in line, buyer totals and open
  buyer questions. Closing marks every clear winner sold and saves the Sales Record as a PDF. Each
  buyer is marked waiting, paid or never paid.
* **Second Chance**: when a winner doesn't pay inside the window set in the profile, the lot can go
  to the next in line at the same price, with the message ready to copy or send.
* **Money chase**: once a showcase closes, every buyer still waiting to pay has a one tap reminder
  with their lots, total, shipping and payment handles. Marking a buyer paid folds them out of the list.
* **Season totals**: plants sold, gross taken, shipping collected and unpaid, by week, month and
  season (a calendar year), with a month by month season file for a tax preparer.
* **Price memory**: a plant name sold before quietly shows its last price and sale date, on the
  plant, on the lot and in the showcase's lot list.
* **Sale Sheet**: one .xlsx file carries a showcase to Google Sheets or Excel and back. Export any
  showcase (with claims and payments once it's run) or a blank sheet, type the lots at a keyboard,
  and import it to build the lots in order. Rows that can't be read are flagged by row number before
  import. Photos stay a phone step.
* **Commons seal**: inside the Commons format only, a Commons Verified Grower number on the profile
  puts the circular seal on stamped photo copies, the grower number in their stamp band in place of the seller number, and the banner across a saved card image. The art
  is drawn from `src/core/seal.ts`, after the reference art kept with the Commons records. The app
  prints the number the seller enters; the desk checks it against the register.
* **Buyer memory**: built from the sales record. A quiet line in Claims for returning buyers, a repeat
  flag in the rundown, and one short note per buyer.
* **Leftovers**: unclaimed and never paid lots from closed showcases, relisted in one tap.
* **Sales record**: searchable, exports a CSV file.
* **Origin line** on every card and stamped photo.
* **Sample showcase**: one tap from the welcome panel or the profile screen opens a finished sample
  with a made up seller and buyers, so every main screen shows full. It lives in memory only; the
  seller's own data is set aside and comes back untouched.
* **Suggest a feature**: the profile screen links out to the feature suggestions form.

## Getting the test build

Every push to `main` builds an Android APK and publishes it to the
[test build release](../../releases/tag/test-build). Open that page on the phone, download the
`.apk`, and install it.

## The browser preview

Every push to `main` also publishes the web build to
[hydracoresystems.github.io/seller-card-app](https://hydracoresystems.github.io/seller-card-app/), a
taste for iPhone waitlisters with the sample showcase one tap away. It's labeled as a preview on every
screen, and keeps anything typed in that browser only.

## Code map

* `src/core/` holds plain TypeScript with no app dependencies: formats, claim reading, lot numbering,
  stamp layout, the sales record export. It's shared with the free web card maker later.
* `src/core/formats/` has one file per posting format. A format pack is a new file registered in
  `formats/index.ts`. Every format has both layers.
* `src/core/brand.ts` holds the app name and the origin line. The product name is still open; change
  it there. It also holds the room's words every template speaks: a sale event is a Grower Showcase,
  a post for a plant is a Market Listing. Commons Market, Commons Verified Grower and the Commons name
  appear only inside the Commons format.
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

## Two versions from one codebase

The build variant is the `EXPO_PUBLIC_APP_VARIANT` setting, read in `src/core/variant.ts`.

* **Production** (nothing set): the app that goes to the App Store, installed as "Skrybix". The checkout
  chain is in it but locked behind Pro, which is an auto renewable subscription (see `src/lib/iap.ts`).
* **Phil test version** (`EXPO_PUBLIC_APP_VARIANT=phil`): the same app with the whole buyer checkout chain
  and every Part Two item on and unlocked. There is no paywall in it. It installs beside the production
  app as "Skrybix Phil" (package `com.gatheringmoss.sellercard.phil`) with its own data. `app.config.js`
  makes that switch, and `app.json` is the production app.

```bash
npm run test:phil       # the same checks, run as the Phil version
npm run start:phil      # run the Phil version
EXPO_PUBLIC_APP_VARIANT=phil npx eas-cli@latest build --platform android   # a Phil build
```

### Pro and the paywall

Pro is two Apple auto renewable subscriptions, `com.gatheringmoss.sellercard.pro.monthly` and
`com.gatheringmoss.sellercard.pro.annual`, in one subscription group. The annual plan carries the seven
day free trial, set as an introductory offer in App Store Connect. The app shows prices and the trial
only from what the App Store reports. The library is `expo-iap` (pinned exactly), used only in
`src/lib/iap.ts`, and only in the production build on iOS. `src/core/entitlement.ts` holds the logic that
needs no phone. In the store, `pro` is on while a Pro subscription is active, and the last paid answer
is remembered so Pro stays on with no signal. Anything locked sends the seller to `/paywall`. The Phil
version holds `pro` on and never opens the store.

### Drive backup (Pro)

The seller connects their own Google account once (`/backup`). The app then keeps one file,
`skrybix-backup.json` in a folder called Skrybix in their Drive. Photos stay on the phone: the file holds their names only (flip `BACKUP_PHOTO_FILES` in `core/backup.ts` to upload them too). Nothing passes
through a server of ours and no Google credential leaves the phone: the sign in is OAuth code with PKCE
through the system browser, the refresh token sits in the phone's secure storage, and the only scope is
`drive.file`, so the app sees just the files it made.

Format, version 1: `{ app: "skrybix", version, revision, savedAt, savedBy: "phone" | "computer", photos, data }`.
`revision` goes up by one on every write and is checked before each write, so two devices never overwrite
each other silently. Photo addresses are stored as `skrybix-photo:NAME` and turned back into the phone's
own paths on restore. A reader that meets a higher `version` stops. The logic is in `src/core/backup.ts`,
`drive.ts` and `backupRun.ts` (tested with stand ins); `src/lib/googleAuth.ts` and `driveBackup.ts` are the
phone side; `src/lib/backupContext.tsx` runs the schedule (after a sale closes, otherwise at most every ten
minutes while the app is in use, never while the sample showcase is open).

Google setup: one Cloud project, ID `skrybix` (number 289863330767), Drive API on, `drive.file` on the
consent screen. Each build uses the iOS client made for its own bundle ID, kept in
`src/core/googleClients.json` (the IDs are public). `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` overrides it.
`app.config.js` adds the reversed client ID as the URL scheme. The computer version needs a Web client in
the same project (`web` in the same file). Android is not wired yet.

### The computer version (Pro)

`/desk` in the web export, built into the same Expo app (`src/ui/desk/`, `src/core/desk.ts`). The seller
signs in with Google in the browser (Google's own sign in library, a short lived token, no server of
ours). It reads `skrybix-backup.json`, shows the rundown, packing list, label file and what you kept,
and writes changes back as the next revision with `savedBy: "computer"`. Each change is applied to the
newest copy on Drive and changes are made one at a time, so a change from the phone is never lost. The
phone looks for a newer copy every five minutes while it has nothing unsaved, and takes it silently; if
both changed, the backup screen asks which copy to keep. The page needs a Web OAuth client in the same
Google Cloud project as the iOS clients (put its ID in `web` in `src/core/googleClients.json`, with the
page's address as an authorized JavaScript origin), or it cannot see the files the phone made. The
backup carries `meta.pro`, written by the phone, because a web page cannot ask Apple.

House style for anything a member reads (app copy, card text, store text): plain words,
contractions welcome, and no dashes of any kind. A test checks every format for dashes.

## Setup walk, first sale checklist, Help

The setup walk (`src/screens/SetupWalk.tsx`, route `/setup`) opens once on a fresh install and can be rerun from Profile as Setup walkthrough. Its state is `guide.v1` in the same phone storage as the profile (`src/core/guide.ts`), and is not part of a backup. The first sale checklist (`src/ui/FirstSaleChecklist.tsx`) reads each stage from the sale's own data (`src/core/firstSale.ts`). The Help entry in Profile shows only when `SKRYBIX_GUIDE_URL` in `src/core/brand.ts` is not empty.
