import { SeedRealtimeRolePermissions1791000005100 } from './migrations/1791000005100-SeedRealtimeRolePermissions';
import { CreateRealtimePresenceAndWatermarkTables1791000006820 } from './migrations/1791000006820-CreateRealtimePresenceAndWatermarkTables';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const REALTIME_MIGRATIONS = [SeedRealtimeRolePermissions1791000005100, CreateRealtimePresenceAndWatermarkTables1791000006820];
