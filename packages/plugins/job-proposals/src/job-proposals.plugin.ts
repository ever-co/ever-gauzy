
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProposalRepository } from 'repository';

@Plugin({
	imports: [
		TypeOrmModule.forFeature([Proposal]),
		MikroOrmModule.forFeature([Proposal]),
		RolePermissionModule
	],
	entities: [Proposal],
	controllers: [ProposalController],
	providers: [ProposalService, TypeOrmProposalRepository, ...CommandHandlers],
	exports: [ProposalService]
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
