# The Play upload key

The upload key proves a bundle sent to Google Play came from us. Google Play App Signing holds the
key that actually signs the app on buyers' phones, so if the upload key is ever lost, Play support
can reset it. It is still worth keeping safe.

Signing is automatic. Under Phil's ruling of November 5, 2026, the key lives in this repo's GitHub
Actions secrets as PLAY_UPLOAD_KEYSTORE (the key file, base64 encoded) and
PLAY_UPLOAD_KEYSTORE_PASSWORD (its password). The play-bundle workflow builds the bundle, signs it
with that key in the build, verifies the signature, and puts the signed bundle on the play-bundle
release. Nobody signs a bundle by hand. The earlier design, where the workflow shipped an unsigned
bundle and Phil signed it on his own computer, was retired by that ruling.

The original key file also stays on Phil's computer as the offline backup: `seller-card-app-upload.jks`
in the Seller Card App keys folder in his user folder, alias `upload`, with its password in his
password vault under the entry Seller Card App upload key. If the secrets ever have to be set again,
Phil sets them from that file and that vault entry; the password is never typed into a chat.

## What Phil does for each release

Download the signed bundle, seller-card-app-<run number>.aab, from the
[play-bundle release](https://github.com/HydraCoreSystems/seller-card-app/releases/tag/play-bundle)
and upload it to the closed test track in the Play Console. That is the whole of his part.
