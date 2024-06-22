import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { i4netAIService } from '@gauzy/integration-ai';
import { IMatchingCriterions } from '@gauzy/contracts';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../../employee-job-preset/repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler implements ICommandHandler<SaveEmployeeCriterionCommand> {

	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly gauzyAIService: i4netAIService
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: SaveEmployeeCriterionCommand): Promise<IMatchingCriterions> {
		const { input } = command;

		// Set tenantId
		input.tenantId = RequestContext.currentTenantId();

		// Set organizationId if not provided in the input
		if (!input.organizationId) {
			const employeeId = RequestContext.currentEmployeeId();
			if (employeeId) {
				const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId });
				input.organizationId = employee.organizationId;
			}
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
		this.gauzyAIService.synci4netEmployeeJobSearchCriteria(
			employee,
			criteria
		);
		return creation;
	}
}
