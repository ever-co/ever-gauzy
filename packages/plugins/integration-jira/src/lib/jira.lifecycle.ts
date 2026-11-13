import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JiraCatalogService } from './jira-catalog.service';
import { isJiraConfigured, JiraCloudConfig } from './jira-config';
import { isJiraEnabled } from './jira-enabled';
import { JIRA_CONFIG } from './jira.constants';

/**
 * Lists "Jira" among the integrations when the API is up, and says once whether the OAuth application
 * is configured. It reads `JIRA_ENABLED` again first: when the module was loaded although the switch
 * is no longer `true`, it does nothing at all.
 */
@Injectable()
export class JiraLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('Jira');

	constructor(private readonly catalog: JiraCatalogService, @Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig) {}

	async onApplicationBootstrap(): Promise<void> {
		if (!isJiraEnabled(process.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			this.logger.log(
				isJiraConfigured(this.config)
					? 'The Jira integration is loaded (JIRA_ENABLED=true).'
					: 'The Jira integration is loaded, but JIRA_CLIENT_ID, JIRA_CLIENT_SECRET or the callback URL is missing: nobody can connect until they are set.'
			);
		} catch (error) {
			// Never stop the API: the catalogue row is written again at the next start.
			this.logger.warn(`The Jira catalogue entry could not be written (${error instanceof Error ? error.name : 'error'}).`);
		}
	}
}
