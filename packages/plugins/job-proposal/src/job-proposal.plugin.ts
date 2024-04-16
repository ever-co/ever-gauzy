
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { Proposal } from './proposal/proposal.entity';
import { ProposalModule } from './proposal/proposal.moule';
import { EmployeeProposalTemplateModule } from './proposal-template/employee-proposal-template.module';
import { EmployeeProposalTemplate } from './proposal-template/employee-proposal-template.entity';

@Plugin({
	imports: [ProposalModule, EmployeeProposalTemplateModule],
	entities: [Proposal, EmployeeProposalTemplate],
	configuration: (config: ApplicationPluginConfig) => {
		config.customFields.Tag.push({
			propertyPath: 'proposals',
			type: 'relation',
			relationType: 'many-to-many',
			entity: Proposal,
			inverseSide: (it: Proposal) => it.tags
		});
		return config;
	}
})
export class JobProposalPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

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
}
