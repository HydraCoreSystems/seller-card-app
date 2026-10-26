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
  puts the circular seal on stamped photo copies and the banner across a saved card image. The art
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

House style for anything a member reads (app copy, card text, store text): plain words,
contractions welcome, and no dashes of any kind. A test checks every format for dashes.
