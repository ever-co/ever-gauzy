import { CreateTaskAutomationTables1791000007310 } from './migrations/1791000007310-CreateTaskAutomationTables';
import { SeedTaskAutomationRolePermissions1791000007320 } from './migrations/1791000007320-SeedTaskAutomationRolePermissions';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const TASK_AUTOMATION_MIGRATIONS = [CreateTaskAutomationTables1791000007310, SeedTaskAutomationRolePermissions1791000007320];
