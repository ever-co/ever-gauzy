import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { EVER_STATS_ENTITIES } from './entities';
import { EverStatsModule } from './ever-stats.module';

/**
 * Anonymous usage statistics: one signed report a day to Ever Platform with counts, module switches
 * and monthly totals per currency, never a name, an address or a record (schema `ever.stats.v1`).
 *
 * On by default. `EVER_STATS_ENABLED=false` leaves it out of the API entirely (no route, no timer, no
 * request); the operator's switch in Settings keeps it loaded and sends nothing.
 */
@Plugin({
	imports: [EverStatsModule.register()],
	entities: [...EVER_STATS_ENTITIES]
})
export class EverStatsPlugin {}
