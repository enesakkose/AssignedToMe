const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Shared provider code lives in ../packages/core and is used from source (no copy in node_modules), so Metro must
// watch it and the packages it imports (zod, noble crypto), wherever Bun put them.
const core = path.resolve(__dirname, "../packages/core");
const coreDeps = Object.keys(require(path.join(core, "package.json")).dependencies ?? {}).map(
  (dep) => fs.realpathSync(path.join(core, "node_modules", dep)),
);

const config = getDefaultConfig(__dirname);
config.watchFolders = [core, ...coreDeps];
config.resolver.extraNodeModules = { "@mytask/core": core };

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
