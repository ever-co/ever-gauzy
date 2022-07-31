import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
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
		const { query } = command;
		const ids: string | string[] = query.ids;
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
		const { organizationId } = query;

		for await (const id of Object.values(ids)) {
			const query = this.timeSlotRepository.createQueryBuilder('time_slot');
			query.setFindOptions({
				relations: {
					timeLogs: true,
					screenshots: true
				}
			});
			query.where((qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
						web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
						web.andWhere(`"${qb.alias}"."id" = :id`, { id });
					})
				);
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"${qb.alias}"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				qb.addOrderBy(`"${qb.alias}"."createdAt"`, 'ASC');
			});
			const timeSlots: ITimeSlot[] = await query.getMany();
			if (isEmpty(timeSlots)) {
				continue;
			}

			for await (const timeSlot of timeSlots) {
				if (timeSlot && isNotEmpty(timeSlot.timeLogs)) {
					const timeLogs = timeSlot.timeLogs.filter(
						(timeLog) => timeLog.isRunning === false
					);
					if (isNotEmpty(timeLogs)) {
						for await (const timeLog of timeLogs) {
							await this.commandBus.execute(
								new DeleteTimeSpanCommand(
									{
										start: timeSlot.startedAt,
										end: timeSlot.stoppedAt
									},
									timeLog,
									timeSlot
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
