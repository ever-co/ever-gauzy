import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TimeSlot } from '../../../time-slot.entity';
import { DeleteTimeSpanCommand } from '../../../time-log/commands/delete-time-span.command';
import { DeleteTimeSlotCommand } from '../delete-time-slot.command';

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

		const timeSlots = await this.timeSlotRepository.find({
			where: { id: In(ids) }
		});
		for (let i = 0; i < ids.length; i++) {
			const timeSlot = await this.timeSlotRepository.findOne({
				where: {
					startedAt: timeSlots[i].startedAt
				},
				relations: ['timeLogs']
			});
			if (timeSlot && timeSlot.timeLogs.length > 0) {
				const deleteSlotPromise = timeSlot.timeLogs.map(
					async (timeLog) => {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(
								{
									start: timeSlot.startedAt,
									end: timeSlot.stoppedAt
								},
								timeLog
							)
						);
						return;
					}
				);

				await Promise.all(deleteSlotPromise);
			}
		}
		return true;
	}
}
