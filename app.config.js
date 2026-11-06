// One codebase, two apps. app.json holds the production app, Skrybix.
// Building with EXPO_PUBLIC_APP_VARIANT=phil makes Phil's test version, which installs beside it
// under its own package name and its own data, so neither can touch the other.
//
// The Google iOS client for each build lives in src/core/googleClients.json, one per bundle ID.
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID overrides it. The client switches the Drive backup on, and its
// reversed form is registered as a URL scheme so Google can send the seller back to the app.
const clients = require('./src/core/googleClients.json');
const meta = require('./src/core/metaConfig.json');
const SUFFIX = '.apps.googleusercontent.com';

module.exports = ({ config }) => {
  const phil = process.env.EXPO_PUBLIC_APP_VARIANT === 'phil';
  const out = phil
    ? {
        ...config,
        name: 'Skrybix Phil',
        slug: config.slug,
        // The second scheme is Facebook's own return address for the Page demonstration.
        scheme: ['sellercardphil', `fb${meta.appId}`],
        ios: { ...config.ios, bundleIdentifier: 'com.gatheringmoss.sellercard.phil' },
        android: { ...config.android, package: 'com.gatheringmoss.sellercard.phil' },
      }
    : config;
  const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || (phil ? clients.ios.phil : clients.ios.production);
  if (!id || !id.endsWith(SUFFIX)) return out;
  const scheme = `com.googleusercontent.apps.${id.slice(0, -SUFFIX.length)}`;
  const info = out.ios?.infoPlist ?? {};
  return {
    ...out,
    ios: { ...out.ios, infoPlist: { ...info, CFBundleURLTypes: [...(info.CFBundleURLTypes ?? []), { CFBundleURLSchemes: [scheme] }] } },
  };
};
