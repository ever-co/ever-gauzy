import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReportOrganizationCreateCommand } from '../report-organization-create.command';
import { ReportOrganizationService } from '../../report-organization.service';

@CommandHandler(ReportOrganizationCreateCommand)
export class ReportOrganizationCreateHandler implements ICommandHandler<ReportOrganizationCreateCommand> {

	constructor(
		private readonly _reportOrganizationService: ReportOrganizationService
	) { }

	/**
	 * Executes the creation of multiple report organization entries.
	 *
	 * @param event The event containing input data for creating report organization entries.
	 * @returns A promise that resolves to the result of bulk creation of report organization entries.
	 */
	public async execute(event: ReportOrganizationCreateCommand) {
		try {
			const { input } = event;
			return await this._reportOrganizationService.bulkCreateOrganizationReport(input);
		} catch (error) {
			console.error(`Error occurred while executing bulk creation of report organization entries: ${error.message}`);
		}
	}
}
