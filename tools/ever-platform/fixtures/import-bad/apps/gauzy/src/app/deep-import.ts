// Known-bad: a module's file instead of its entry point, and a lazy import of a module.
import { readEverConnectConfig } from '@gauzy/plugin-ever-connect/src/lib/ever-connect-config';
export const lazy = () => import('@gauzy/plugin-ever-stats-ui');
export { readEverConnectConfig };
// A specifier inside a string is not an import: "import x from '@gauzy/plugin-ever-connect'"
