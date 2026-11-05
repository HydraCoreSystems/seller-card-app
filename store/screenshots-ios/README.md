# App Store screenshots, Skrybix

Source: the production variant at commit cc04f5b (EXPO_PUBLIC_APP_VARIANT unset). Seven shots, two sizes.

* iPhone 6.9 inch: 1320 by 2868
* iPad 13 inch: 2064 by 2752

How they were made: the production web export, driven in headless Chromium at 440 by 956 (iPhone, scale 3) and 1032 by 1376 (iPad, scale 2). These are renders of the production screens, not captures from an iPhone or iPad, so there is no iOS status bar, home indicator or system font.

The harness (harness folder) is a scratch copy of cc04f5b with two changes, both outside the screens themselves: demo data for the tie, the rundown and the stamped photos, and the entitlement state. Shots 5 and 6 turn Pro on. Shot 7 fills in the store's product data.

Shot 7 is a filled render, not a live store capture. Off device the App Store products cannot load, so the paywall shows the two products as StoreKit returns them: annual 59.99 with a seven day free trial, monthly 7.99.

Shot 2 shows the production announcement with the location line, from a seeded profile with city, state and ZIP.

Shot 7 on the iPhone was rendered at a wider logical width (550 by 1195, scale 2.4) so the whole paywall fits from the top of its scroll in the same 1320 by 2868 canvas.
