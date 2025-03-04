import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { StatusTypesMapRequestApprovalEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { TimeOffRequest } from '../../time-off-request.entity';
import { TimeOffUpdateCommand } from '../time-off.update.command';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { TimeOffRequestService } from '../../time-off-request.service';

@CommandHandler(TimeOffUpdateCommand)
export class TimeOffUpdateHandler implements ICommandHandler<TimeOffUpdateCommand> {
	constructor(
		private readonly _requestApprovalService: RequestApprovalService,
		private readonly _timeOffRequestService: TimeOffRequestService
	) {}

	/**
	 * Updates an existing time off request by deleting the old record, saving a new one,
	 * and updating its associated approval record.
	 *
	 * @param command - An object containing the identifier of the existing request and the new time off data.
	 * @returns A promise that resolves to the newly saved TimeOffRequest.
	 */
	public async execute(command: TimeOffUpdateCommand): Promise<TimeOffRequest> {
		const { id, input } = command;

		try {
			// Delete the existing time off request and its associated request approval concurrently.
			await Promise.all([
				this._timeOffRequestService.delete(id),
				this._requestApprovalService.delete({ requestId: id })
			]);

			// Save the new time off request.
			const timeOffRequest = await this._timeOffRequestService.create(input);

			// Create a new request approval record for the updated time off request.
			await this._requestApprovalService.create({
				requestId: timeOffRequest.id,
				status: timeOffRequest.status
					? StatusTypesMapRequestApprovalEnum[timeOffRequest.status]
					: RequestApprovalStatusTypesEnum.REQUESTED,
				name: 'Request time off',
				min_count: 1
			});

			return timeOffRequest;
		} catch (error) {
			throw new HttpException(
				`Error while updating time off request: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
