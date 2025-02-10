import * as chalk from 'chalk';
import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { GithubModule } from './github/github.module';
import { OrganizationGithubRepository } from './github/repository/github-repository.entity';
import { OrganizationGithubRepositoryIssue } from './github/repository/issue/github-repository-issue.entity';

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [GithubModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [OrganizationGithubRepository, OrganizationGithubRepositoryIssue],
	/**
	 * A callback that receives the main plugin configuration object and allows
	 * custom modifications before returning the final configuration.
	 *
	 * @param {ApplicationPluginConfig} config - The initial plugin configuration object.
	 * @returns {ApplicationPluginConfig} - The modified plugin configuration object.
	 *
	 * In this example, we're adding a custom relation field (`proposals`) to the `Tag` entity.
	 */
	configuration: (config: ApplicationPluginConfig) => {
		// Add a custom field to the OrganizationProject entity
		config.customFields.OrganizationProject.push({
			name: 'repository',
			type: 'relation',
			relationType: 'many-to-one',
			entity: OrganizationGithubRepository,
			nullable: true, // Determines whether the relation is nullable.
			onDelete: 'SET NULL' // Defines the database cascade action on delete.
		});

		// Add a custom field to the OrganizationProject entity
		config.customFields.OrganizationProject.push({
			name: 'repositoryId',
			type: 'string',
			relation: 'repository',
			nullable: true, // Determines whether the relation is nullable.
			relationId: true,
			index: true
		});
		return config;
	}
})
export class IntegrationGithubPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationGithubPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationGithubPlugin.name} is being destroyed...`));
		}
	}
}
