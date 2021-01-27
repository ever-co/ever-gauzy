import { GauzyAIService } from '@gauzy/integration-ai';
import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context/request-context';
import { Employee } from '../../../employee/employee.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler
	implements ICommandHandler<SaveEmployeeCriterionCommand> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,
		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>,
		private gauzyAIService: GauzyAIService
	) {}

	public async execute(
		command: SaveEmployeeCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;

		input.tenantId = RequestContext.currentTenantId();

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				input.employeeId || user.employeeId
			);
			input.organizationId = employee.organizationId;
		}

		const creation = new EmployeeUpworkJobsSearchCriterion(input);

		await this.employeeUpworkJobsSearchCriterionRepository.save(creation);

		const employee = await this.employeeRepository.findOne(
			input.employeeId,
			{ relations: ['user'] }
		);
		const criteria = await this.employeeUpworkJobsSearchCriterionRepository.find(
			{
				employeeId: input.employeeId,
				jobPresetId: input.jobPresetId
			}
		);

		this.gauzyAIService.syncGauzyEmployeeJobSearchCriteria(
			employee,
			criteria
		);
		return creation;
	}
}
