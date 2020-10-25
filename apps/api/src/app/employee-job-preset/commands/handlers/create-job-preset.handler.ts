import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context/request-context';
import { Employee } from '../../../employee/employee.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler
	implements ICommandHandler<CreateJobPresetCommand> {
	constructor(
		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			input.organizationId = employee.organizationId;
		}
		input.tenantId = RequestContext.currentTenantId();
		const jobPreset = new JobPreset(input);

		if (input.employees) {
			input.employees = input.employees.map(
				(employee) => new JobPreset(employee)
			);
		}

		if (input.jobPresetCriterion) {
			input.jobPresetCriterion = input.jobPresetCriterion.map(
				(employee) => new JobPresetUpworkJobSearchCriterion(employee)
			);
		}

		const found = this.jobPresetRepository.count({
			where: {
				organizationId: input.organizationId,
				tenantId: input.tenantId,
				name: input.name
			}
		});

		if (found) {
			await this.jobPresetRepository.save(jobPreset);
			return jobPreset;
		} else {
			return null;
		}
	}
}
