import { EverInstance } from '@gauzy/plugin-ever-instance';
import { EverStatsLease } from './ever-stats-lease.entity';
import { EverStatsReport } from './ever-stats-report.entity';

export * from './ever-stats-lease.entity';
export * from './ever-stats-report.entity';

/** Every entity the plugin registers. Their tables are created by core migrations. */
export const EVER_STATS_ENTITIES = [EverInstance, EverStatsReport, EverStatsLease];
