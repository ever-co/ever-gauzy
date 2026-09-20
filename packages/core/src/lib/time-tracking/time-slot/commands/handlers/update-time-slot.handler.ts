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
		const employeeId = this.resolveEmployeeScope(input.employeeId);
		if (employeeId === null) {
			return null;
		}

		const where = {
			...(employeeId ? { employeeId } : {}),
			tenantId,
			id
		};

		const timeSlot = await this.typeOrmTimeSlotRepository.findOne({ where });

		if (!timeSlot) {
			return null;
		}

		if (Array.isArray(input.activities) && input.activities.length) {
			await this.saveActivities(input.activities, timeSlot, tenantId);
		}

		const changes = this.collectChanges(input);

		if (Object.keys(changes).length) {
			await this.typeOrmTimeSlotRepository.update({ id: timeSlot.id, tenantId }, changes);
		}

		return await this.typeOrmTimeSlotRepository.findOne({
			where,
			relations: {
				timeLogs: true,
				screenshots: true,
				activities: true
			}
		});
	}

	/**
	 * The employee the lookup is narrowed to: the body's for a caller who may act for any employee of
	 * the tenant, the caller's own otherwise. `null` means the request may not edit any slot at all.
	 *
	 * @param requestedEmployeeId - The employeeId carried by the request body.
	 */
	private resolveEmployeeScope(requestedEmployeeId: ID | undefined): ID | undefined | null {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return requestedEmployeeId;
		}
		return RequestContext.currentUser()?.employeeId || null;
	}

	/**
	 * The changes the body is allowed to make, taken from {@link UPDATABLE_TIME_SLOT_FIELDS} only, so
	 * tenantId / organizationId / employeeId and the relation arrays can never be mass-assigned.
	 *
	 * @param input - The request body.
	 */
	private collectChanges(input: Partial<ITimeSlot>): Partial<ITimeSlot> {
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

		return changes;
	}

	/**
	 * Saves the body's activities on their own and attaches them to THIS slot: their ids, relation
	 * objects and scope columns come from the slot, never from the body.
	 *
	 * @param activities - The activities carried by the request body.
	 * @param timeSlot - The slot they are attached to.
	 * @param tenantId - The caller's tenant.
	 */
	private async saveActivities(activities: ITimeSlot['activities'], timeSlot: TimeSlot, tenantId: ID): Promise<void> {
		const scoped = await scopeActivitiesForWrite(
			activities.map((activity) => ({ ...activity })),
			this.typeOrmActivityRepository,
			{ tenantId, employeeId: timeSlot.employeeId }
		);

		const entities = scoped.map((activity) => {
			const entity = new Activity(activity);
			entity.employeeId = timeSlot.employeeId;
			entity.organizationId = timeSlot.organizationId;
			entity.tenantId = tenantId;
			entity.timeSlotId = timeSlot.id;
			return entity;
		});

		await this.typeOrmActivityRepository.save(entities);
	}
}
