import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import moment from 'moment';
import { Between } from 'typeorm';
import { IntegrationEntity, ITimeSlot } from '@gauzy/contracts';
import { TimeSlotCreateCommand } from './../../../time-slot/commands';
import { ActivityCreateCommand } from '../activity-create.command';
import { ActivityService } from './../../../activity/activity.service';
import { TimeSlotService } from './../../../time-slot/time-slot.service';
import { RequestContext } from './../../../../core/context';

@CommandHandler(ActivityCreateCommand)
export class ActivityCreateHandler
	implements ICommandHandler<ActivityCreateCommand> {

	constructor(
		private readonly _activityService: ActivityService,
		private readonly _timeSlotService: TimeSlotService,
		private readonly _commandBus: CommandBus
	) {}

	public async execute(command: ActivityCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const {
				title,
				duration,
				type,
				projectId,
				date,
				time,
				employeeId,
				taskId,
				organizationId,
				activityTimestamp
			} = input;
			const tenantId = RequestContext.currentTenantId();

			const startedAt = moment(moment.utc(activityTimestamp).format('YYYY-MM-DD HH:mm:ss')).toDate();
			const stoppedAt = moment(moment.utc(activityTimestamp).add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss')).toDate();

			let timeSlot: ITimeSlot;
			try {
				timeSlot = await this._timeSlotService.findOneByOptions({
					where: {
						employeeId,
						organizationId,
						tenantId,
						startedAt: Between<Date>(startedAt, stoppedAt),
					}
				});
			} catch (error) {
				timeSlot = await this._commandBus.execute(
					new TimeSlotCreateCommand({
						tenantId,
						organizationId,
						employeeId,
						duration: 0,
						keyboard: 0,
						mouse: 0,
						overall: 0,
						startedAt: new Date(moment.utc(activityTimestamp).format()),
						time_slot: new Date(moment.utc(activityTimestamp).format())
					})
				);
			}

			return await this._activityService.create({
				title,
				duration,
				type,
				date,
				time,
				projectId,
				employeeId,
				taskId,
				organizationId,
				timeSlot
			});
		} catch (error) {
			throw new BadRequestException(error, `Can'\t create ${IntegrationEntity.ACTIVITY} for ${IntegrationEntity.TIME_SLOT}`);
		}
	}
}
