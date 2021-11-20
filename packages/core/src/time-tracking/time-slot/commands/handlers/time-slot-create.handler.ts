import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { IntegrationEntity, ITimeSlot } from '@gauzy/contracts';
import { TimeSlotCreateCommand } from './../time-slot-create.command';
import { TimeSlotService } from './../../time-slot.service';
import { RequestContext } from './../../../../core/context';

@CommandHandler(TimeSlotCreateCommand)
export class TimeSlotCreateHandler
	implements ICommandHandler<TimeSlotCreateCommand> {

	constructor(
		private readonly _timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeSlotCreateCommand): Promise<ITimeSlot> {
		try {
			const { input } = command;
			const tenantId = RequestContext.currentTenantId();

			const {
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				time_slot,
				organizationId
			}: ITimeSlot = input;

			return await this._timeSlotService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt: new Date(
					moment(time_slot).format('YYYY-MM-DD HH:mm:ss')
				),
				organizationId,
				tenantId
			});
		} catch (error) {
			throw new BadRequestException(error, `Can\'t create ${IntegrationEntity.TIME_SLOT}`);
		}
	}
}
