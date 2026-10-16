import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { EverWorksCatalogService } from './ever-works-catalog.service';
import { isEverWorksEnabled } from './ever-works-enabled';
import { EVER_WORKS_ENV } from './ever-works.tokens';

/**
 * Lists "Ever Works" among the integrations when the API is up. Without a connection the plugin sends
 * nothing and schedules nothing.
 *
 * It reads `EVER_WORKS_ENABLED` again first: when the module was loaded although the switch is no
 * longer `true` (a settings file read after the plugin list was built), it does nothing at all.
 */
@Injectable()
export class EverWorksLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('EverWorks');
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly catalog: EverWorksCatalogService,
		@Optional() @Inject(EVER_WORKS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async onApplicationBootstrap(): Promise<void> {
		if (!isEverWorksEnabled(this.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			this.logger.log('The Ever Works integration is loaded (EVER_WORKS_ENABLED=true).');
		} catch (error) {
			// Never stop the API: the catalog row is written again at the next start.
			this.logger.warn(
				`The Ever Works catalog entry could not be written (${error instanceof Error ? error.name : 'error'}).`
			);
		}
	}
}
