import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { IMatchingCriterions, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { SaveEmployeeCriterionCommand } from '../save-employee-criterion.command';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../repository/type-orm-employee-upwork-jobs-search-criterion.repository';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';

@CommandHandler(SaveEmployeeCriterionCommand)
export class SaveEmployeeCriterionHandler implements ICommandHandler<SaveEmployeeCriterionCommand> {
	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository
	) {}

	/**
	 * Executes the logic to save employee criterion.
	 * @param command The command containing the input data.
	 * @returns Promise<IMatchingCriterions> A promise resolving to the created matching criterion.
	 */
	public async execute(command: SaveEmployeeCriterionCommand): Promise<IMatchingCriterions> {
		const { input } = command;

		// The caller's tenant, and no other: every write below goes through a raw repository
		input.tenantId = RequestContext.currentTenantId();

		// If the current user has the permission to change the selected employee, use their ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			input.employeeId = RequestContext.currentEmployeeId();
		}
		// Every lookup below is a raw repository query keyed on employeeId; an empty id must fail here
		// rather than turn into an unscoped query (a null key used to be dropped from the SQL).
		if (!input.employeeId) {
			throw new BadRequestException('employeeId is required');
		}
		const { tenantId } = input;
		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}

		// The employee must exist IN THIS TENANT before anything is persisted for them (raw repository —
		// scope explicitly). Its organization fills a missing organizationId.
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: { id: input.employeeId, tenantId },
			relations: { user: true, organization: true }
		});
		if (!employee) {
			throw new NotFoundException(`Employee with id ${input.employeeId} not found`);
		}
		if (!input.organizationId) {
			input.organizationId = employee.organizationId;
		}

		// A preset must be one of this tenant, and an id may only name one of this employee's own criteria: the
		// raw `save` below updates whatever row the id names, in any tenant, and moves it into this one
		if (
			input.jobPresetId &&
			!(await this.typeOrmJobPresetRepository.findOneBy({ id: input.jobPresetId, tenantId }))
		) {
			throw new NotFoundException('Job preset not found');
		}
		if (
			input.id &&
			!(await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findOneBy({
				id: input.id,
				employeeId: input.employeeId,
				tenantId
			}))
		) {
			throw new NotFoundException('Employee job search criterion not found');
		}

		// Create criteria
		const creation = new EmployeeUpworkJobsSearchCriterion(input);
		await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(creation);

		// Find criteria for the employee
		const criteria = await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findBy({
			employeeId: input.employeeId,
			jobPresetId: input.jobPresetId,
			tenantId
		});

		// Sync Gauzy AI criteria with the employee
		this._gauzyAIService.syncGauzyEmployeeJobSearchCriteria(employee, criteria);

		return creation;
	}
}
