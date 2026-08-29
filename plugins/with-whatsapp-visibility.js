const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Declares WhatsApp in the Android manifest's `<queries>` block.
 *
 * Android 11 (API 30) hides other installed apps from us unless they are named
 * here, which makes `Linking.canOpenURL('whatsapp://…')` answer false even when
 * WhatsApp is sitting on the home screen. Sharing still works, because the code
 * falls back to the wa.me link, but the user gets bounced through the browser
 * instead of straight into the chat.
 *
 * The Expo app config has no field for `<queries>`, so it is written during
 * prebuild. The iOS equivalent is `ios.infoPlist.LSApplicationQueriesSchemes`,
 * which is set in app.json.
 */
const VISIBLE_PACKAGES = [
  'com.whatsapp',
  // A lot of people in India run only WhatsApp Business.
  'com.whatsapp.w4b',
];

module.exports = function withWhatsAppVisibility(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    const [queries = {}, ...otherQueries] = manifest.queries ?? [];
    const declared = queries.package ?? [];

    const missing = VISIBLE_PACKAGES.filter(
      (packageName) => !declared.some((entry) => entry.$?.['android:name'] === packageName)
    ).map((packageName) => ({ $: { 'android:name': packageName } }));

    manifest.queries = [{ ...queries, package: [...declared, ...missing] }, ...otherQueries];
    return config;
  });
};
