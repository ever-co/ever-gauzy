import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDashboardWidget } from '@gauzy/contracts';
import { DashboardWidgetService } from '../../dashboard-widget.service';
import { DashboardWidgetUpdateCommand } from '../dashboard-widget.update.command';

@CommandHandler(DashboardWidgetUpdateCommand)
export class DashboardWidgetUpdateHandler implements ICommandHandler<DashboardWidgetUpdateCommand> {
	constructor(private readonly dashboardWidgetService: DashboardWidgetService) {}

	/**
	 * Handles the DashboardWidgetUpdateCommand to update an existing dashboard widget.
	 *
	 * @param command - The command containing the id and input data for dashboard widget update.
	 * @returns A promise that resolves to the updated dashboard widget.
	 */
	public async execute(command: DashboardWidgetUpdateCommand): Promise<IDashboardWidget> {
		const { id, input } = command;
		return this.dashboardWidgetService.update(id, input);
	}
}
