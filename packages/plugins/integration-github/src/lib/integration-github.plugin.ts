import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { GithubModule } from './github/github.module';
import { OrganizationGithubRepository } from './github/repository/github-repository.entity';
import { OrganizationGithubRepositoryIssue } from './github/repository/issue/github-repository-issue.entity';

@Plugin({
	imports: [GithubModule],
	entities: [OrganizationGithubRepository, OrganizationGithubRepositoryIssue],
	configuration: (config: ApplicationPluginConfig) => {
		config.customFields.OrganizationProject.push({
			name: 'repository',
			type: 'relation',
			relationType: 'many-to-one',
			entity: OrganizationGithubRepository,
			nullable: true, // Determines whether the relation is nullable.
			onDelete: 'SET NULL' // Defines the database cascade action on delete.
		});
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
			console.log(`${IntegrationGithubPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${IntegrationGithubPlugin.name} is being destroyed...`);
		}
	}
}
