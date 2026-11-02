# Duo screenshot set

Sixteen PNGs for iPhone Duo: eight screens at the outer display size (1398 by 2034) and the same eight at the inner display canvas (2007 by 2853).

These are renders of the production screens from the web export, the same way the iPhone and iPad store sets were made. They are not device captures. There is no Duo hardware or simulator in the build environment, so the layouts are checked at the Duo point sizes (outer 466 by 678, inner 669 by 951, at scale 3) in a browser. Before upload, recapture the set from the Duo simulator profiles in Xcode 27.1 if the store wants real captures.

Screens: sale builder, announcement and lots, announcement beside a lot card (02b), plant with stamped photos, claim tracker with a tie, Pro rundown, packing view, paywall.

Reproduce: apply `harness/harness-data.patch` to a clean checkout, export the web build, serve it with `harness/serve.js` on port 8099, then run `node harness/shots.js inner OUTDIR` and `node harness/shots.js outer OUTDIR`. The script checks each page for stray text and writes a CHECK line per shot.
