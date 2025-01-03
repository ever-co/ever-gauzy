import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboardWidget } from '@gauzy/contracts';
import { DashboardWidgetService } from '../../dashboard-widget.service';
import { DashboardWidgetCreateCommand } from '../dashboard-widget.create.command';

@CommandHandler(DashboardWidgetCreateCommand)
export class DashboardWidgetCreateHandler implements ICommandHandler<DashboardWidgetCreateCommand> {
	constructor(private readonly dashboardWidgetService: DashboardWidgetService) {}

	/**
	 * Handles the DashboardWidgetCreateCommand to create a new dashboard widget.
	 *
	 * @param command - The command containing the input data for dashboard widget creation.
	 * @returns A promise that resolves to the created dashboard widget.
	 */
	public async execute(command: DashboardWidgetCreateCommand): Promise<IDashboardWidget> {
		const { input } = command;
		return this.dashboardWidgetService.create(input);
	}
}
