import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { Proposal } from './proposal/proposal.entity';
import { ProposalModule } from './proposal/proposal.moule';
import { EmployeeProposalTemplateModule } from './proposal-template/employee-proposal-template.module';
import { EmployeeProposalTemplate } from './proposal-template/employee-proposal-template.entity';
import { ProposalSeederService } from './proposal/proposal-seeder.service';

@Plugin({
	imports: [ProposalModule, EmployeeProposalTemplateModule],
	entities: [Proposal, EmployeeProposalTemplate],
	configuration: (config: ApplicationPluginConfig) => {
		config.customFields.Tag.push({
			propertyPath: 'proposals',
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

	constructor(
		private readonly _proposalSeederService: ProposalSeederService
	) { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalPlugin.name} is being destroyed...`);
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
