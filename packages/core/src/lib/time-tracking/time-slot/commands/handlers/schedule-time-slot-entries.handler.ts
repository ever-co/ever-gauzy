import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/utils';
import { ScheduleTimeSlotEntriesCommand } from '../schedule-time-slot-entries.command';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { MultiORM, MultiORMEnum, getORMType } from './../../../../core/utils';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../../repository/mikro-orm-time-slot.repository';

@CommandHandler(ScheduleTimeSlotEntriesCommand)
export class ScheduleTimeSlotEntriesHandler implements ICommandHandler<ScheduleTimeSlotEntriesCommand> {
	protected ormType: MultiORM = getORMType();

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository
	) {}

	/**
	 * Executes the correction of invalid time slot entries.
	 * Filters time slots with values outside the permitted range [0, 600]
	 * for duration, overall, keyboard, and mouse activity, and clamps them.
	 *
	 * @param command - The command to trigger adjustment.
	 * @returns A promise that resolves when the adjustment is complete.
	 */
	public async execute(command: ScheduleTimeSlotEntriesCommand): Promise<void> {
		const { organizationId, tenantId } = command;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmTimeSlotRepository.getKnex();
				const timeSlots = await knex('time_slot')
					.withSchema(knex.userParams.schema)
					.select('id', 'duration', 'overall', 'keyboard', 'mouse')
					.where({ tenantId, organizationId })
					.andWhere(function () {
						this.where('overall', '<', 0)
							.orWhere('overall', '>', 600)
							.orWhere('keyboard', '<', 0)
							.orWhere('keyboard', '>', 600)
							.orWhere('mouse', '<', 0)
							.orWhere('mouse', '>', 600)
							.orWhere('duration', '<', 0)
							.orWhere('duration', '>', 600);
					});

				if (isNotEmpty(timeSlots)) {
					for (const slot of timeSlots) {
						await knex('time_slot')
							.withSchema(knex.userParams.schema)
							.where({ id: slot.id })
							.update({
								duration: Math.min(600, Math.max(0, slot.duration)),
								overall: Math.min(600, Math.max(0, slot.overall)),
								keyboard: Math.min(600, Math.max(0, slot.keyboard)),
								mouse: Math.min(600, Math.max(0, slot.mouse))
							});
					}
				}
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

				// Optimization: Only select the required fields to reduce memory usage and avoid unnecessary data retrieval
				query.select([
					`${query.alias}.id`,
					`${query.alias}.duration`,
					`${query.alias}.overall`,
					`${query.alias}.keyboard`,
					`${query.alias}.mouse`
				]);

				// Scope to the current tenant and organization first
				query.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

				// Then find slots with invalid values (outside the [0, 600] range)
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						const params = { min: 0, max: 600 };
						web.orWhere(p(`"${query.alias}"."overall" < :min`), params);
						web.orWhere(p(`"${query.alias}"."overall" > :max`), params);
						web.orWhere(p(`"${query.alias}"."keyboard" < :min`), params);
						web.orWhere(p(`"${query.alias}"."keyboard" > :max`), params);
						web.orWhere(p(`"${query.alias}"."mouse" < :min`), params);
						web.orWhere(p(`"${query.alias}"."mouse" > :max`), params);
						web.orWhere(p(`"${query.alias}"."duration" < :min`), params);
						web.orWhere(p(`"${query.alias}"."duration" > :max`), params);
					})
				);

				const timeSlots = await query.getMany();

				if (isNotEmpty(timeSlots)) {
					const corrected = timeSlots.map((timeSlot) => ({
						id: timeSlot.id,
						duration: Math.min(600, Math.max(0, timeSlot.duration)),
						overall: Math.min(600, Math.max(0, timeSlot.overall)),
						keyboard: Math.min(600, Math.max(0, timeSlot.keyboard)),
						mouse: Math.min(600, Math.max(0, timeSlot.mouse))
					}));

					// Use the repository's save method for bulk update
					await this.typeOrmTimeSlotRepository.save(corrected);
				}
				break;
			}
		}
	}
}
