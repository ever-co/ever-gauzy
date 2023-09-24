import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { IntegrationTenantUpdateOrCreateCommand } from '../integration-tenant-update-or-create.command';

@CommandHandler(IntegrationTenantUpdateOrCreateCommand)
export class IntegrationTenantUpdateOrCreateHandler implements ICommandHandler<IntegrationTenantUpdateOrCreateCommand> {

	constructor(
		@Inject(forwardRef(() => IntegrationTenantService))
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	public async execute(
		event: IntegrationTenantUpdateOrCreateCommand
	) {
		const { options, input } = event;
		console.log({ options, input }, this._integrationTenantService);

		// const { options, input = {} as IImportRecord } = event;
		// const payload = Object.assign({}, options, input) as IImportRecord;

		// const {
		// 	sourceId,
		// 	destinationId,
		// 	entityType,
		// 	tenantId = RequestContext.currentTenantId()
		// } = payload;

		// try {
		// 	const record = await this._importRecordService.findOneByWhereOptions(options);
		// 	if (record) {
		// 		return {
		// 			...await this._importRecordService.create({
		// 				id: record.id,
		// 				tenantId,
		// 				sourceId,
		// 				destinationId,
		// 				entityType
		// 			}),
		// 			wasCreated: false
		// 		};
		// 	}
		// } catch (error) {
		// 	return {
		// 		...await this._importRecordService.create({
		// 			tenantId,
		// 			sourceId,
		// 			destinationId,
		// 			entityType
		// 		}),
		// 		wasCreated: true
		// 	};
		// }
	}
}
