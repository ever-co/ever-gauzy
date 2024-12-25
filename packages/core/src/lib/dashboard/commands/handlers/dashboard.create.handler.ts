import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardCreateCommand } from '../dashboard.create.command';

@CommandHandler(DashboardCreateCommand)
export class DashboardCreateHandler implements ICommandHandler<DashboardCreateCommand> {
	constructor(private readonly dashboardService: DashboardService) {}

	public async execute(command: DashboardCreateCommand): Promise<IDashboard> {
		const { input } = command;
		return await this.dashboardService.create(input);
	}
}
