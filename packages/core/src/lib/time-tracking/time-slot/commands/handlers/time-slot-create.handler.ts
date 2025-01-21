import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { IntegrationEntity, ITimeSlot } from '@gauzy/contracts';
import { TimeSlotCreateCommand } from './../time-slot-create.command';
import { RequestContext } from './../../../../core/context';
import { TimeSlot } from './../../../../core/entities/internal';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(TimeSlotCreateCommand)
export class TimeSlotCreateHandler implements ICommandHandler<TimeSlotCreateCommand> {
	constructor(private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository) {}

	public async execute(command: TimeSlotCreateCommand): Promise<ITimeSlot> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		const { employeeId, duration, keyboard, mouse, overall, time_slot, organizationId }: ITimeSlot = input;

		try {
			const entity = this.typeOrmTimeSlotRepository.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt: new Date(moment(time_slot).format('YYYY-MM-DD HH:mm:ss')),
				organizationId,
				tenantId
			});
			return await this.typeOrmTimeSlotRepository.save(entity as TimeSlot);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t create ${IntegrationEntity.TIME_SLOT}`);
		}
	}
}
