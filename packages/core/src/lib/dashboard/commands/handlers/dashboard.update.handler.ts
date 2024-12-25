import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardUpdateCommand } from '../dashboard.update.command';

@CommandHandler(DashboardUpdateCommand)
export class DashboardUpdateHandler implements ICommandHandler<DashboardUpdateCommand> {
	constructor(private readonly dashboardService: DashboardService) {}

	/**
	 * Handles the DashboardUpdateCommand to update an existing dashboard.
	 *
	 * @param command - The command containing the id and input data for dashboard update.
	 * @returns A promise that resolves to the updated dashboard.
	 */
	public async execute(command: DashboardUpdateCommand): Promise<IDashboard> {
		const { id, input } = command;
		return this.dashboardService.update(id, input);
	}
}
