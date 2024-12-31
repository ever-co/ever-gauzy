import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { Proposal } from './proposal/proposal.entity';
import { ProposalModule } from './proposal/proposal.module';
import { EmployeeProposalTemplateModule } from './proposal-template/employee-proposal-template.module';
import { EmployeeProposalTemplate } from './proposal-template/employee-proposal-template.entity';
import { ProposalSeederService } from './proposal/proposal-seeder.service';

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [ProposalModule, EmployeeProposalTemplateModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [Proposal, EmployeeProposalTemplate],
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
		// Add a new 'proposals' tag to the 'Tag' entity
		config.customFields.Tag.push({
			name: 'proposals',
			type: 'relation',
			relationType: 'many-to-many',
			pivotTable: 'tag_proposal',
			joinColumn: 'proposalId',
			inverseJoinColumn: 'tagId',
			entity: Proposal,
			inverseSide: (it: Proposal) => it.tags
		});

		return config;
	}
})
export class JobProposalPlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor(private readonly _proposalSeederService: ProposalSeederService) {}

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${JobProposalPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${JobProposalPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Seed default data for the plugin.
	 */
	async onPluginDefaultSeed() {
		try {
			this._proposalSeederService.createDefaultProposals();

			if (this.logEnabled) {
				console.log(chalk.green(`Default data seeded successfully for ${JobProposalPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding default data for ${JobProposalPlugin.name}:`, error));
		}
	}

	/**
	 * Seed random data for the plugin.
	 */
	async onPluginRandomSeed() {
		try {
			this._proposalSeederService.createRandomProposals();

			if (this.logEnabled) {
				console.log(chalk.green(`Random data seeded successfully for ${JobProposalPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding random data for ${JobProposalPlugin.name}:`, error));
		}
	}
}
