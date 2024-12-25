import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardUpdateCommand } from '../dashboard.update.command';

@CommandHandler(DashboardUpdateCommand)
export class DashboardUpdateHandler implements ICommandHandler<DashboardUpdateCommand> {
	constructor(private readonly dashboardService: DashboardService) {}

	public async execute(command: DashboardUpdateCommand): Promise<IDashboard> {
		const { id, input } = command;
		return await this.dashboardService.update(id, input);
	}
}
