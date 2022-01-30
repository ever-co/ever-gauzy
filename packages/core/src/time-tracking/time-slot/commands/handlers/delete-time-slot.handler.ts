import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { TimeSlot } from './../../time-slot.entity';
import { DeleteTimeSpanCommand } from '../../../time-log/commands/delete-time-span.command';
import { DeleteTimeSlotCommand } from '../delete-time-slot.command';
import { RequestContext } from './../../../../core/context';

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
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You can not delete time slots');
		}

		let employeeIds: string[] = [];
		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		const tenantId = RequestContext.currentTenantId();
		for await (const id of Object.values(ids)) {
			const timeSlots = await this.timeSlotRepository.find({
				where: (query: SelectQueryBuilder<TimeSlot>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => { 
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"${query.alias}"."id" = :id`, { id });
						})
					);
					if (isNotEmpty(employeeIds)) {
						query.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					query.addOrderBy(`"${query.alias}"."createdAt"`, 'ASC');
				},
				relations: ['timeLogs', 'screenshots']
			});
			if (isEmpty(timeSlots)) {
				continue;
			}
			for await (const timeSlot of timeSlots) {
				if (timeSlot && isNotEmpty(timeSlot.timeLogs)) {
					const timeLogs = timeSlot.timeLogs.filter(
						(timeLog) => timeLog.stoppedAt
					);
					if (isNotEmpty(timeLogs)) {
						for await (const timeLog of timeLogs) {
							await this.commandBus.execute(
								new DeleteTimeSpanCommand(
									{
										start: timeSlot.startedAt,
										end: timeSlot.stoppedAt
									},
									timeLog
								)
							);
						}
					}
				}
			}
		}
		return true;
	}
}
