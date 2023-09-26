import { Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantCreateCommand } from '../integration-tenant.create.command';
import { IntegrationTenantFirstOrCreateCommand } from '../integration-tenant-first-or-create.command';
import { IntegrationTenantGetCommand } from '../integration-tenant.get.command';

@Injectable()
@CommandHandler(IntegrationTenantFirstOrCreateCommand)
export class IntegrationTenantFirstOrCreateHandler implements ICommandHandler<IntegrationTenantFirstOrCreateCommand> {

	constructor(
		private readonly _commandBus: CommandBus
	) { }

	public async execute(
		command: IntegrationTenantFirstOrCreateCommand
	) {
		const { options, input } = command;
		try {
			return await this._commandBus.execute(
				new IntegrationTenantGetCommand({
					where: {
						...options
					}
				})
			);
		} catch (error) {
			return await this._commandBus.execute(
				new IntegrationTenantCreateCommand(input)
			);
		}
	}
}
