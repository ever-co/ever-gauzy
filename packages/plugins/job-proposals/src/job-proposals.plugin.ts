
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { RolePermissionModule } from '@gauzy/core';
import { ApplicationPluginConfig } from '@gauzy/common';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProposalRepository } from './repository/type-orm-proposal.repository';

@Plugin({
	imports: [
		TypeOrmModule.forFeature([Proposal]),
		MikroOrmModule.forFeature([Proposal]),
		RolePermissionModule,
		CqrsModule
	],
	entities: [Proposal],
	controllers: [ProposalController],
	providers: [ProposalService, TypeOrmProposalRepository, ...CommandHandlers],
	exports: [ProposalService],
	configuration: (config: ApplicationPluginConfig) => {
		config.customFields.Tag.push(
			{
				name: 'proposals',
				type: 'relation',
				relation: 'many-to-many',
				entity: Proposal,
				inverseSide: (it: Proposal) => it.tags
			}
		);
		return config;
	}
})
export class JobProposalsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalsPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalsPlugin.name} is being destroyed...`);
		}
	}
}
