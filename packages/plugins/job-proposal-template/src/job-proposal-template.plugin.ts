
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyCorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { RolePermissionModule } from '@gauzy/core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
import { TypeOrmEmployeeProposalTemplateRepository } from './repository/type-orm-employee-proposal-template.repository';

@GauzyCorePlugin({
	imports: [RolePermissionModule, CqrsModule],
	entities: [EmployeeProposalTemplate],
	controllers: [EmployeeProposalTemplateController],
	providers: [EmployeeProposalTemplateService, TypeOrmEmployeeProposalTemplateRepository]
})
export class JobProposalTemplatePlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalTemplatePlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobProposalTemplatePlugin.name} is being destroyed...`);
		}
	}
}
