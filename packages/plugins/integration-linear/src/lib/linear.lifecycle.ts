import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { LinearCatalogService } from './linear-catalog.service';
import { isLinearConfigured, LinearConfig } from './linear-config';
import { isLinearEnabled } from './linear-enabled';
import { LINEAR_CONFIG } from './linear.constants';

/**
 * Lists "Linear" among the integrations when the API is up, and says once whether the OAuth application
 * is configured. It reads `LINEAR_ENABLED` again first: when the module was loaded although the switch
 * is no longer `true`, it does nothing at all.
 */
@Injectable()
export class LinearLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('Linear');

	constructor(private readonly catalog: LinearCatalogService, @Inject(LINEAR_CONFIG) private readonly config: LinearConfig) {}

	async onApplicationBootstrap(): Promise<void> {
		if (!isLinearEnabled(process.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			this.logger.log(
				isLinearConfigured(this.config)
					? 'The Linear integration is loaded (LINEAR_ENABLED=true).'
					: 'The Linear integration is loaded, but LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET or the callback URL is missing: nobody can connect until they are set.'
			);
		} catch (error) {
			// Never stop the API: the catalogue row is written again at the next start.
			this.logger.warn(`The Linear catalogue entry could not be written (${error instanceof Error ? error.name : 'error'}).`);
		}
	}
}
