import { GauzyAIService } from '@gauzy/integration-ai';
import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context';
import { Employee } from '../../../employee/employee.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler
	implements ICommandHandler<SaveEmployeeCriterionCommand> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,

		private readonly gauzyAIService: GauzyAIService
	) {}

	public async execute(
		command: SaveEmployeeCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;
		input.tenantId = RequestContext.currentTenantId();

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOneBy({
				id: input.employeeId || user.employeeId
			});
			input.organizationId = employee.organizationId;
		}

		const creation = new EmployeeUpworkJobsSearchCriterion(input);
		await this.employeeUpworkJobsSearchCriterionRepository.save(creation);

		const employee = await this.employeeRepository.findOne({
			where: {
				id: input.employeeId
			},
			relations: {
				user: true
			}
		});
		const criteria = await this.employeeUpworkJobsSearchCriterionRepository.findBy({
			employeeId: input.employeeId,
			jobPresetId: input.jobPresetId
		})
		this.gauzyAIService.syncGauzyEmployeeJobSearchCriteria(
			employee,
			criteria
		);
		return creation;
	}
}
