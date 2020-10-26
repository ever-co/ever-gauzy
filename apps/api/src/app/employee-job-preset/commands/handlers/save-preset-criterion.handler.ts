import { MatchingCriterions } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context/request-context';
import { Employee } from '../../../employee/employee.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler
	implements ICommandHandler<SavePresetCriterionCommand> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<
			EmployeeUpworkJobsSearchCriterion
		>,
		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<
			JobPresetUpworkJobSearchCriterion
		>
	) {}

	public async execute(
		command: SavePresetCriterionCommand
	): Promise<MatchingCriterions> {
		const { input } = command;

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			input.organizationId = employee.organizationId;
		}
		input.tenantId = RequestContext.currentTenantId();

		if (input.employeeId) {
			const creation = new EmployeeUpworkJobsSearchCriterion(input);
			await this.employeeUpworkJobsSearchCriterionRepository.save(
				creation
			);
			return creation;
		} else {
			const creation = new JobPresetUpworkJobSearchCriterion(input);
			await this.jobPresetUpworkJobSearchCriterionRepository.save(
				creation
			);
			return creation;
		}
	}
}
