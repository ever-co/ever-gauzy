import { HttpException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpStatus, IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardUpdateCommand } from '../dashboard.update.command';

@CommandHandler(DashboardUpdateCommand)
export class DashboardUpdateHandler implements ICommandHandler<DashboardUpdateCommand> {
	private readonly logger = new Logger(DashboardUpdateHandler.name);

	constructor(private readonly dashboardService: DashboardService) {}

	/**
	 * Handles the DashboardUpdateCommand to update an existing dashboard.
	 *
	 * @param command - The command containing the id and input data for dashboard update.
	 * @returns A promise that resolves to the updated dashboard.
	 */
	public async execute(command: DashboardUpdateCommand): Promise<IDashboard> {
		try {
			const { id, input } = command;
			return await this.dashboardService.update(id, input);
		} catch (error) {
			this.logger.error('Failed to update dashboard', error.stack);
			throw new HttpException(`Error while updating dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
