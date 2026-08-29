const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with a local keystore instead of the debug key.
 *
 * `expo prebuild` generates an `android/` project whose release build type is
 * signed with the debug key. That APK installs, but it is not something that
 * can be shipped, and the generated project is thrown away and rewritten every
 * time a native dependency changes — so the signing config has to be reapplied
 * from here rather than edited by hand.
 *
 * The keystore and the `keystore.properties` file naming it both sit outside
 * `android/`, so that regenerating the project does not delete them, and both
 * are gitignored. When they are absent the block below does nothing and release
 * builds keep the debug key, so a fresh clone still builds without credentials.
 *
 * Appending a second `android { }` block, rather than editing the one Expo
 * writes, means there is no generated line this depends on staying put.
 */
const MARKER = '// Release signing, added by plugins/with-release-signing.js';

const SIGNING_BLOCK = `
${MARKER}
def releaseKeystorePropertiesFile = rootProject.file("../keystore.properties")
if (releaseKeystorePropertiesFile.exists()) {
    def releaseKeystoreProperties = new Properties()
    releaseKeystorePropertiesFile.withInputStream { releaseKeystoreProperties.load(it) }

    android {
        signingConfigs {
            release {
                storeFile file(releaseKeystoreProperties['storeFile'])
                storePassword releaseKeystoreProperties['storePassword']
                keyAlias releaseKeystoreProperties['keyAlias']
                keyPassword releaseKeystoreProperties['keyPassword']
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        `with-release-signing expects a Groovy build.gradle, found ${config.modResults.language}.`
      );
    }

    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += SIGNING_BLOCK;
    }

    return config;
  });
};
