import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardCreateCommand } from '../dashboard.create.command';

@CommandHandler(DashboardCreateCommand)
export class DashboardCreateHandler implements ICommandHandler<DashboardCreateCommand> {
	private readonly logger = new Logger(DashboardCreateHandler.name);

	constructor(private readonly dashboardService: DashboardService) {}

	/**
	 * Handles the DashboardCreateCommand to create a new dashboard.
	 *
	 * @param command - The command containing the input data for dashboard creation.
	 * @returns A promise that resolves to the created dashboard.
	 */
	public async execute(command: DashboardCreateCommand): Promise<IDashboard> {
		try {
			const { input } = command;
			return await this.dashboardService.create(input);
		} catch (error) {
			this.logger.error('Failed to create dashboard', error.stack);
			throw new HttpException(`Error while creating dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
