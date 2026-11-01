// One codebase, two apps. app.json holds the production app, Skrybix.
// Building with EXPO_PUBLIC_APP_VARIANT=phil makes Phil's test version, which installs beside it
// under its own package name and its own data, so neither can touch the other.
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'phil') return config;
  return {
    ...config,
    name: 'Skrybix Phil',
    slug: config.slug,
    scheme: 'sellercardphil',
    ios: { ...config.ios, bundleIdentifier: 'com.gatheringmoss.sellercard.phil' },
    android: { ...config.android, package: 'com.gatheringmoss.sellercard.phil' },
  };
};
