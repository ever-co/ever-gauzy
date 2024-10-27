import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { IMatchingCriterions, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../repository/type-orm-employee-upwork-jobs-search-criterion.repository';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler implements ICommandHandler<SaveEmployeeCriterionCommand> {
	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly _gauzyAIService: GauzyAIService
	) {}

	/**
	 * Executes the logic to save employee criterion.
	 * @param command The command containing the input data.
	 * @returns Promise<IMatchingCriterions> A promise resolving to the created matching criterion.
	 */
	public async execute(command: SaveEmployeeCriterionCommand): Promise<IMatchingCriterions> {
		const { input } = command;

		// Set tenantId
		input.tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// If the current user has the permission to change the selected employee, use their ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			input.employeeId = RequestContext.currentEmployeeId();
		}

		// Set organizationId if not provided in the input
		if (!input.organizationId && input.employeeId) {
			const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: input.employeeId });
			input.organizationId = employee.organizationId;
		}

		// Create criteria
		const creation = new EmployeeUpworkJobsSearchCriterion(input);
		await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(creation);

		// Find employee by ID
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: { id: input.employeeId },
			relations: { user: true, organization: true }
		});

		// Find criteria for the employee
		const criteria = await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findBy({
			employeeId: input.employeeId,
			jobPresetId: input.jobPresetId
		});

		// Sync Gauzy AI criteria with the employee
		this._gauzyAIService.syncGauzyEmployeeJobSearchCriteria(employee, criteria);

		return creation;
	}
}
