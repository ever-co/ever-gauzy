import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler
	implements ICommandHandler<CreateJobPresetCommand> {
	constructor(
		@InjectRepository(JobPreset)
		private readonly JobPresetRepository: Repository<JobPreset>
	) {}

	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		const jobPreset = new JobPreset(input);

		this.JobPresetRepository.save(jobPreset);

		return jobPreset;
	}
}
