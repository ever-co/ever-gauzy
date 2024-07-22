import * as chalk from 'chalk';
import { environment } from '@gauzy/config';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { JiraModule } from './jira.module';
import { JiraModuleOptions } from './jira.types';
import { parseOptions } from './jira.helpers';

const { jira } = environment;

@Plugin({
	imports: [
		JiraModule.forRoot({
			isGlobal: true,
			path: 'integration/jira',
			config: {
				appName: jira.appName,
				appDescription: jira.appDescription,
				appKey: jira.appKey,
				baseUrl: jira.baseUrl,
				vendorName: jira.vendorName,
				vendorUrl: jira.vendorUrl
			}
		})
	]
})
export class IntegrationJiraPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;
	static options: JiraModuleOptions = {} as JiraModuleOptions;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationJiraPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationJiraPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Initializes the Sentry module with options
	 * @param options Sentry module options
	 * @returns The initialized Sentry module
	 */
	static init(options: JiraModuleOptions): typeof IntegrationJiraPlugin {
		this.options = parseOptions(options);
		return this;
	}
}
