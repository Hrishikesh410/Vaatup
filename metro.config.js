// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite ships a WebAssembly build for the web target. Without these two
// pieces the web bundle cannot load it: Metro has to serve .wasm as an asset,
// and the page needs COOP/COEP set for SharedArrayBuffer to be available.
config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (request, response, next) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(request, response, next);
};

module.exports = config;
