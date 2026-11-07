import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TrelloCatalogService } from './trello-catalog.service';
import { isTrelloConfigured, TrelloConfig } from './trello-config';
import { isTrelloEnabled } from './trello-enabled';
import { TRELLO_CONFIG } from './trello.constants';

/**
 * Lists "Trello" among the integrations when the API is up, and says once whether the OAuth application
 * is configured. It reads `TRELLO_ENABLED` again first: when the module was loaded although the switch
 * is no longer `true`, it does nothing at all.
 */
@Injectable()
export class TrelloLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('Trello');

	constructor(private readonly catalog: TrelloCatalogService, @Inject(TRELLO_CONFIG) private readonly config: TrelloConfig) {}

	async onApplicationBootstrap(): Promise<void> {
		if (!isTrelloEnabled(process.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			this.logger.log(
				isTrelloConfigured(this.config)
					? 'The Trello integration is loaded (TRELLO_ENABLED=true).'
					: 'The Trello integration is loaded, but TRELLO_API_KEY or the return page (TRELLO_RETURN_URL, else CLIENT_BASE_URL) is missing: nobody can connect until they are set.'
			);
		} catch (error) {
			// Never stop the API: the catalogue row is written again at the next start.
			this.logger.warn(`The Trello catalogue entry could not be written (${error instanceof Error ? error.name : 'error'}).`);
		}
	}
}
