const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Shared provider code lives in ../packages/core and is used from source (no copy in node_modules), so Metro must
// watch it and the zod it imports.
const core = path.resolve(__dirname, "../packages/core");
const coreZod = path.dirname(require.resolve("zod/package.json", { paths: [core] }));

const config = getDefaultConfig(__dirname);
config.watchFolders = [core, coreZod];
config.resolver.extraNodeModules = { "@mytask/core": core };

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
