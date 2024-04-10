import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/integration-ai';
import { IMatchingCriterions } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../../employee-job-preset/repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler implements ICommandHandler<SaveEmployeeCriterionCommand> {

	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly gauzyAIService: GauzyAIService
	) { }

	public async execute(
		command: SaveEmployeeCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;
		input.tenantId = RequestContext.currentTenantId();

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.typeOrmEmployeeRepository.findOneBy({
				id: input.employeeId || user.employeeId
			});
			input.organizationId = employee.organizationId;
		}

		const creation = new EmployeeUpworkJobsSearchCriterion(input);
		await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(creation);

		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: {
				id: input.employeeId
			},
			relations: {
				user: true,
				organization: true
			}
		});
		const criteria = await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findBy({
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
