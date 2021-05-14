import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReportService } from '../../report.service';
import { ReportOrganizationCreateCommand } from '../report-organization-bulk-create.command';

@CommandHandler(ReportOrganizationCreateCommand)
export class ReportOrganizationCreateHandler implements ICommandHandler<ReportOrganizationCreateCommand> {
	
	constructor(
		@Inject(forwardRef(() => ReportService))
		private readonly _reportService: ReportService
	) {}

	public async execute(event: ReportOrganizationCreateCommand) {
		const { input } = event;
		return await this._reportService.bulkCreateOrganizationReport(
			input
		);
	}
}