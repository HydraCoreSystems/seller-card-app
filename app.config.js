// One codebase, two apps. app.json holds the production app, Skrybix.
// Building with EXPO_PUBLIC_APP_VARIANT=phil makes Phil's test version, which installs beside it
// under its own package name and its own data, so neither can touch the other.
//
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is the Google iOS client made for the build's own bundle ID. It
// switches the Drive backup on, and its reversed form is registered as a URL scheme so Google can
// send the seller back to the app after signing in.
const SUFFIX = '.apps.googleusercontent.com';

module.exports = ({ config }) => {
  const phil = process.env.EXPO_PUBLIC_APP_VARIANT === 'phil';
  const out = phil
    ? {
        ...config,
        name: 'Skrybix Phil',
        slug: config.slug,
        scheme: 'sellercardphil',
        ios: { ...config.ios, bundleIdentifier: 'com.gatheringmoss.sellercard.phil' },
        android: { ...config.android, package: 'com.gatheringmoss.sellercard.phil' },
      }
    : config;
  const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!id || !id.endsWith(SUFFIX)) return out;
  const scheme = `com.googleusercontent.apps.${id.slice(0, -SUFFIX.length)}`;
  const info = out.ios?.infoPlist ?? {};
  return {
    ...out,
    ios: { ...out.ios, infoPlist: { ...info, CFBundleURLTypes: [...(info.CFBundleURLTypes ?? []), { CFBundleURLSchemes: [scheme] }] } },
  };
};
