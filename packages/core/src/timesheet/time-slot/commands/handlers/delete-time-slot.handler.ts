import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TimeSlot } from '../../../time-slot.entity';
import { DeleteTimeSpanCommand } from '../../../time-log/commands/delete-time-span.command';
import { DeleteTimeSlotCommand } from '../delete-time-slot.command';
import { ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../../core/context/request-context';

@CommandHandler(DeleteTimeSlotCommand)
export class DeleteTimeSlotHandler
	implements ICommandHandler<DeleteTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: DeleteTimeSlotCommand): Promise<boolean> {
		const { ids } = command;		
		let employeeIds: string[] = [];
		if (
			!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		} 
		const query = this.timeSlotRepository.createQueryBuilder();
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoinAndSelect(`${query.alias}.screenshots`, 'screenshots');
		query.andWhere(`"${query.alias}"."id" IN (:...ids)`, { ids });

		if (employeeIds.length) {
			query.andWhere(
				`"${query.alias}"."employeeId" IN (:...employeeId)`,
				{ employeeId: employeeIds }
			);
		}

		const timeSlots = await query.getMany();
		if (!timeSlots.length) {
			return true;
		}

		timeSlots.forEach(async (timeSlot: ITimeSlot) => {
			if (timeSlot && timeSlot.timeLogs.length > 0) {
				const deleteSlotPromise = timeSlot.timeLogs
					.filter((timeLog) => timeLog.stoppedAt)
					.map(
						async (timeLog) => {
							await this.commandBus.execute(
								new DeleteTimeSpanCommand(
									{ start: timeSlot.startedAt, end: timeSlot.stoppedAt },
									timeLog
								)
							);
							return;
						}
					);
				await Promise.all(deleteSlotPromise);
			}
		});
		return true;
	}
}
