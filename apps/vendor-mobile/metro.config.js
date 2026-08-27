const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo setup: resolve @indus/* workspace packages and let Metro watch them.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

// react-native-web is hoisted to the workspace root (it's only a dependency
// here, not of admin-web), so its internal require("react")/require("react-dom")
// would otherwise resolve to the root copies (18.3.1, for admin-web) while
// this app's own code and react-native-safe-area-context resolve the nested
// copies here (18.2.0, pinned to match react-native). Two React instances in
// one bundle breaks hooks ("Invalid hook call"). extraNodeModules alone can't
// fix this: Metro only consults it when the normal hierarchical node_modules
// walk fails to find the module at all, and it always succeeds here (root
// node_modules/react exists), so the override below never gets a chance to
// run. Force it instead in resolveRequest by rewriting the lookup's origin to
// this app's own directory for react/react-dom specifically, so the
// hierarchical walk starts here and finds the nested copy before it ever
// reaches the root.
const { resolveRequest: defaultResolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (moduleName === "react" || moduleName === "react-dom" || moduleName.startsWith("react/") || moduleName.startsWith("react-dom/")) {
    return resolve(
      { ...context, originModulePath: path.resolve(projectRoot, "package.json") },
      moduleName,
      platform,
    );
  }

  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    // @indus/* workspace packages resolve straight to their TS source (via
    // tsconfig paths) rather than dist/. That source uses NodeNext-style
    // relative imports (e.g. "./enums.js" pointing at enums.ts), which
    // tsc/tsx remap automatically but Metro's resolver does not. Retry those
    // requests without the trailing ".js" so Metro's normal extension search
    // finds the .ts file.
    if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
