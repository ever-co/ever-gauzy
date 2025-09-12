import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Logger } from '@nestjs/common';
import { ITrackingSession } from '@gauzy/contracts';
import { CustomTrackingBulkCreateCommand } from '../custom-tracking-bulk-create.command';
import { ProcessTrackingDataCommand } from '../process-tracking-data.command';

/**
 * Handler for bulk creation of custom tracking data
 * Processes multiple tracking data entries sequentially to maintain data consistency
 */
@CommandHandler(CustomTrackingBulkCreateCommand)
export class CustomTrackingBulkCreateHandler implements ICommandHandler<CustomTrackingBulkCreateCommand> {
	private readonly logger = new Logger(CustomTrackingBulkCreateHandler.name);

	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Execute bulk creation of custom tracking data
	 * @param command The bulk create command containing array of tracking data inputs
	 * @returns Promise resolving to array of results for each processed entry
	 */
	public async execute(command: CustomTrackingBulkCreateCommand): Promise<
		Array<{
			success: boolean;
			sessionId: string;
			timeSlotId: string;
			message: string;
			session: ITrackingSession | null;
			index: number;
			error?: string;
		}>
	> {
		const { input } = command;
		const results: Array<{
			success: boolean;
			sessionId: string;
			timeSlotId: string;
			message: string;
			session: ITrackingSession | null;
			index: number;
			error?: string;
		}> = [];

		this.logger.log(`Processing bulk custom tracking data: ${input.length} entries`);

		for (let i = 0; i < input.length; i++) {
			const entry = input[i];
			try {
				if (entry.startTime && isNaN(new Date(entry.startTime).getTime())) {
					throw new BadRequestException(`Invalid start time at index ${i}`);
				}

				// Execute individual tracking data processing command
				const result = await this.commandBus.execute(
					new ProcessTrackingDataCommand({
						...entry,
						...(entry.startTime ? { startTime: new Date(entry.startTime) } : {})
					})
				);

				results.push({
					...result,
					index: i
				});

				this.logger.debug(`Successfully processed entry ${i + 1}/${input.length}`);
			} catch (error) {
				this.logger.error(`Failed to process entry ${i + 1}/${input.length}: ${error.message}`, error?.stack);

				results.push({
					success: false,
					sessionId: '',
					timeSlotId: '',
					message: `Failed to process entry: ${error.message}`,
					session: null,
					index: i,
					error: error.message
				});
			}
		}

		const successCount = results.filter((r) => r.success).length;
		const failureCount = results.length - successCount;

		this.logger.log(`Bulk processing completed: ${successCount} successful, ${failureCount} failed`);

		return results;
	}
}
