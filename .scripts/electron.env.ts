// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { DesktopEnvironmentManager } from './electron-desktop-environment/desktop-environment-manager';

DesktopEnvironmentManager.generate();

// we always want first to remove old generated files (one of them is not needed for current build)
