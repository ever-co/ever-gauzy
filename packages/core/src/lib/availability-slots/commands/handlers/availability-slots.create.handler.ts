import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { pluck } from 'underscore';
import { AvailabilityMergeType, IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlotsCreateCommand } from '../availability-slots.create.command';
import { AvailabilitySlotsService } from '../../availability-slots.service';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { RequestContext } from './../../../core/context';

@CommandHandler(AvailabilitySlotsCreateCommand)
export class AvailabilitySlotsCreateHandler
	implements ICommandHandler<AvailabilitySlotsCreateCommand> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: AvailabilitySlotsCreateCommand
	): Promise<IAvailabilitySlot> {
		const { input, insertType } = command;
		const { organizationId, startTime, endTime, type } = input;
		if (!startTime || !endTime) return;
		const tenantId = RequestContext.currentTenantId();

		// Whose hours these are is decided before the conflicts are looked up: the merge below widens the new
		// slot over the conflicting ones and deletes them, so they must be the slot owner's own.
		const employeeId = this.availabilitySlotsService.resolveWriteEmployeeId(input.employeeId);

		const conflicts: IAvailabilitySlot[] = await this.commandBus.execute(
			new GetConflictAvailabilitySlotsCommand({
				employeeId,
				startTime,
				endTime,
				type,
				tenantId,
				organizationId
			})
		);

		if (insertType === AvailabilityMergeType.SKIP) {
			return;
		}

		// A create files a NEW slot, written from the slot's own members: an `id` in the body used to reach an
		// upsert that rewrote that row, whoever's it was.
		let window = { startTime: input.startTime, endTime: input.endTime };

		if (conflicts.length > 0 && insertType === AvailabilityMergeType.MERGE) {
			const startTimes = conflicts.map((item) => new Date(item.startTime).getTime());
			const endTimes = conflicts.map((item) => new Date(item.endTime).getTime());
			window = {
				startTime: new Date(Math.min(new Date(input.startTime).getTime(), ...startTimes)),
				endTime: new Date(Math.max(new Date(input.endTime).getTime(), ...endTimes))
			};
		}

		return await this.availabilitySlotsService.replaceSlots(pluck(conflicts, 'id'), {
			...window,
			allDay: input.allDay,
			type: input.type,
			organizationId,
			tenantId,
			employeeId
		});
	}
}
