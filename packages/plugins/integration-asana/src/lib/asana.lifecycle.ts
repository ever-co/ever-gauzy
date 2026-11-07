import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AsanaCatalogService } from './asana-catalog.service';
import { isAsanaConfigured, AsanaConfig } from './asana-config';
import { isAsanaEnabled } from './asana-enabled';
import { ASANA_CONFIG } from './asana.constants';

/**
 * Lists "Asana" among the integrations when the API is up, and says once whether the OAuth application
 * is configured. It reads `ASANA_ENABLED` again first: when the module was loaded although the switch
 * is no longer `true`, it does nothing at all.
 */
@Injectable()
export class AsanaLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('Asana');

	constructor(private readonly catalog: AsanaCatalogService, @Inject(ASANA_CONFIG) private readonly config: AsanaConfig) {}

	async onApplicationBootstrap(): Promise<void> {
		if (!isAsanaEnabled(process.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			this.logger.log(
				isAsanaConfigured(this.config)
					? 'The Asana integration is loaded (ASANA_ENABLED=true).'
					: 'The Asana integration is loaded, but ASANA_CLIENT_ID, ASANA_CLIENT_SECRET or the callback URL is missing: nobody can connect until they are set.'
			);
		} catch (error) {
			// Never stop the API: the catalogue row is written again at the next start.
			this.logger.warn(`The Asana catalogue entry could not be written (${error instanceof Error ? error.name : 'error'}).`);
		}
	}
}
