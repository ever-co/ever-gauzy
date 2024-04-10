import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '../../../core/context';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler implements ICommandHandler<CreateJobPresetCommand> {

	constructor(
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) { }

	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.typeOrmEmployeeRepository.findOneBy({
				id: user.employeeId
			});
			input.organizationId = employee.organizationId;
		}
		input.tenantId = RequestContext.currentTenantId();

		const jobPreset = new JobPreset(input);

		delete jobPreset.jobPresetCriterions;
		await this.typeOrmJobPresetRepository.save(jobPreset);

		let jobPresetCriterion: JobPresetUpworkJobSearchCriterion[] = [];

		if (input.jobPresetCriterions && input.jobPresetCriterions.length > 0) {
			jobPresetCriterion = input.jobPresetCriterions.map(
				(criterion) =>
					new JobPresetUpworkJobSearchCriterion({
						...criterion,
						jobPresetId: jobPreset.id
					})
			);

			await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.delete({
				jobPresetId: jobPreset.id
			});

			await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.save(
				jobPresetCriterion
			);

			jobPreset.jobPresetCriterions = jobPresetCriterion;

			// jobPreset.jobPresetCriterion = jobPresetCriterion;
			// await this.jobPresetRepository.save(jobPreset);
		}
		return jobPreset;
	}
}
