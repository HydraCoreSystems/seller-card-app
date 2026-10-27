# The Play upload key

The upload key proves a bundle sent to Google Play came from us. Google Play App Signing holds the
key that actually signs the app on buyers' phones, so if the upload key is ever lost, Play support
can reset it. It's still worth keeping safe.

Phil holds it: one key file on his computer with a backup copy, and its password in his password
vault. It never goes into GitHub, the repo, or a chat.

Java's key tools sit in `C:\Users\pwach\Tools\jdk17\bin`. Run the commands below in a PowerShell
window of your own (the Start menu, then PowerShell), since each one asks for the password.

## Make the key (once)

1. In your password vault, make a new entry called **Seller Card App upload key** and have the vault
   generate a strong password for it. Copy that password.
2. Run:

   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\Seller Card App keys" | Out-Null
   & "$env:USERPROFILE\Tools\jdk17\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Phil Achleman, O=Gathering Moss" -keystore "$env:USERPROFILE\Seller Card App keys\seller-card-app-upload.jks"
   ```

3. When it asks for the keystore password, paste the vault password (right click pastes) and press
   Enter. It won't show as you paste. Paste it again when it asks you to confirm.
4. In the vault entry, note the file name `seller-card-app-upload.jks` and the alias `upload`.
5. Copy `seller-card-app-upload.jks` to a second place off this computer: a USB stick kept at home,
   or attached to the vault entry if your vault holds files.

## Sign a bundle (every upload)

The Play bundle workflow puts an unsigned bundle on the
[play-bundle release](https://github.com/HydraCoreSystems/seller-card-app/releases/tag/play-bundle).
Download it into `Seller Card App keys`, then run this, with the number of the bundle you downloaded:

```powershell
$n = 1
& "$env:USERPROFILE\Tools\jdk17\bin\jarsigner.exe" -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$env:USERPROFILE\Seller Card App keys\seller-card-app-upload.jks" -signedjar "$env:USERPROFILE\Seller Card App keys\seller-card-app-$n.aab" "$env:USERPROFILE\Seller Card App keys\seller-card-app-$n-unsigned.aab" upload
```

Paste the vault password when it asks. `seller-card-app-<n>.aab` is the file to upload to the closed
test track in the Play Console. The first upload also tells Play this is the upload key.
