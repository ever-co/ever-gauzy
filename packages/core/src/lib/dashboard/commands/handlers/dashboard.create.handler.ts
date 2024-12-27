import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboard } from '@gauzy/contracts';
import { DashboardService } from '../../dashboard.service';
import { DashboardCreateCommand } from '../dashboard.create.command';

@CommandHandler(DashboardCreateCommand)
export class DashboardCreateHandler implements ICommandHandler<DashboardCreateCommand> {
	constructor(private readonly dashboardService: DashboardService) {}

    /**
     * Handles the DashboardCreateCommand to create a new dashboard.
     *
     * @param command - The command containing the input data for dashboard creation.
     * @returns A promise that resolves to the created dashboard.
     */
    public async execute(command: DashboardCreateCommand): Promise<IDashboard> {
        const { input } = command;
        return this.dashboardService.create(input);
    }
}
