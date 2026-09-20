import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { ID, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { Activity } from '../../../activity/activity.entity';
import { scopeActivitiesForWrite } from '../../../activity/activity-write-scope.helper';
import { UpdateTimeSlotCommand } from '../update-time-slot.command';
import { TimeSlot } from './../../time-slot.entity';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { TypeOrmActivityRepository } from '../../../activity/repository/type-orm-activity.repository';

/**
 * The only time slot columns a client may change through PUT /timesheet/time-slot/:id. Everything
 * else — tenantId, organizationId, employeeId, relation arrays — stays as stored (GHSA-6qvm-3wg4-26w4).
 */
export const UPDATABLE_TIME_SLOT_FIELDS = [
	'duration',
	'keyboard',
	'mouse',
	'overall',
	'location',
	'startedAt',
	'kbMouseActivity',
	'locationActivity',
	'customActivity'
] as const;

@CommandHandler(UpdateTimeSlotCommand)
export class UpdateTimeSlotHandler implements ICommandHandler<UpdateTimeSlotCommand> {
	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly typeOrmActivityRepository: TypeOrmActivityRepository
	) {}

	public async execute(command: UpdateTimeSlotCommand): Promise<TimeSlot> {
		const { input, id } = command;

		// The slot is looked up and written inside the caller's tenant only. The raw repository has no
		// tenant scoping of its own, and OrganizationPermissionGuard is not an ownership check for every
		// caller, so a missing tenant fails closed instead of matching any tenant's slot.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return null;
		}

		// A body employeeId only narrows the lookup, and only for callers who may act for any employee
		// of the tenant. Everyone else is pinned to their own employee; without one there is no slot
		// they may edit (an absent filter would match every employee's slot).
		let employeeId: ID;
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			employeeId = input.employeeId;
		} else {
			employeeId = RequestContext.currentUser()?.employeeId;
			if (!employeeId) {
				return null;
			}
		}

		const where = {
			...(employeeId ? { employeeId } : {}),
			tenantId,
			id
		};

		let timeSlot = await this.typeOrmTimeSlotRepository.findOne({ where });

		if (timeSlot) {
			const changes: Partial<ITimeSlot> = {};
			for (const field of UPDATABLE_TIME_SLOT_FIELDS) {
				if (input[field] !== undefined) {
					changes[field] = input[field];
				}
			}

			if (changes.startedAt) {
				changes.startedAt = moment(changes.startedAt)
					//.set('minute', 0)
					.set('millisecond', 0)
					.toDate();
			}

			if (Array.isArray(input.activities) && input.activities.length) {
				// Activities are saved on their own and attached to THIS slot. Their ids, relation objects
				// and scope columns come from the slot, never from the body.
				const activities = await scopeActivitiesForWrite(
					input.activities.map((activity) => ({ ...activity })),
					this.typeOrmActivityRepository,
					{ tenantId, employeeId: timeSlot.employeeId }
				);
				const newActivities = activities.map((activity) => {
					const entity = new Activity(activity);
					entity.employeeId = timeSlot.employeeId;
					entity.organizationId = timeSlot.organizationId;
					entity.tenantId = tenantId;
					entity.timeSlotId = timeSlot.id;
					return entity;
				});
				await this.typeOrmActivityRepository.save(newActivities);
			}

			if (Object.keys(changes).length) {
				await this.typeOrmTimeSlotRepository.update({ id: timeSlot.id, tenantId }, changes);
			}

			timeSlot = await this.typeOrmTimeSlotRepository.findOne({
				where,
				relations: {
					timeLogs: true,
					screenshots: true,
					activities: true
				}
			});
			return timeSlot;
		} else {
			return null;
		}
	}
}
