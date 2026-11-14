import { CreateTaskAutomationTables1791000007810 } from './migrations/1791000007810-CreateTaskAutomationTables';
import { SeedTaskAutomationRolePermissions1791000007820 } from './migrations/1791000007820-SeedTaskAutomationRolePermissions';
import { CreateTaskAutomationLinkClosureTable1791000009110 } from './migrations/1791000009110-CreateTaskAutomationLinkClosureTable';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const TASK_AUTOMATION_MIGRATIONS = [
	CreateTaskAutomationTables1791000007810,
	SeedTaskAutomationRolePermissions1791000007820,
	CreateTaskAutomationLinkClosureTable1791000009110
];
