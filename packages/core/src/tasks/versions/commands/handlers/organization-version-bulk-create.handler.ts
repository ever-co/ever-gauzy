import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskVersion } from '@gauzy/contracts';
import { OrganizationVersionBulkCreateCommand } from '../organization-version-bulk-create.command';
import { TaskVersionService } from '../../version.service';
import { TaskVersion } from '../../version.entity';

@CommandHandler(OrganizationVersionBulkCreateCommand)
export class OrganizationVersionBulkCreateHandler implements ICommandHandler<OrganizationVersionBulkCreateCommand> {
	constructor(private readonly taskVersionService: TaskVersionService) {}

	public async execute(command: OrganizationVersionBulkCreateCommand): Promise<ITaskVersion[] | TaskVersion[]> {
		const { input } = command;
		return await this.taskVersionService.bulkCreateOrganizationVersions(input);
	}
}
