import { GauzyAIService } from '@gauzy/integration-ai';
import { IMatchingCriterions } from '@gauzy/models';
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
		>,
		private gauzyAIService: GauzyAIService
	) {}

	public async execute(
		command: SavePresetCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			input.organizationId = employee.organizationId;
		}
		input.tenantId = RequestContext.currentTenantId();
		let creation: any;
		if (input.employeeId) {
			const criteriaCounts = await this.employeeUpworkJobsSearchCriterionRepository.count(
				{
					employeeId: input.employeeId,
					jobPresetId: input.jobPresetId
				}
			);

			creation = new EmployeeUpworkJobsSearchCriterion(input);

			if (criteriaCounts === 0) {
				let jobCreation = await this.jobPresetUpworkJobSearchCriterionRepository.find(
					{
						jobPresetId: input.jobPresetId
					}
				);
				let found = false;
				jobCreation = jobCreation.map((item) => {
					if (creation && creation.id === item.id) {
						item = creation;
						found = true;
					}
					return new EmployeeUpworkJobsSearchCriterion({
						...item,
						employeeId: input.employeeId
					});
				});
				if (!found) {
					jobCreation.push(creation);
				}
				await this.employeeUpworkJobsSearchCriterionRepository.save(
					jobCreation
				);
			} else {
				await this.employeeUpworkJobsSearchCriterionRepository.save(
					creation
				);
			}

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
		} else {
			creation = new JobPresetUpworkJobSearchCriterion(input);
			await this.jobPresetUpworkJobSearchCriterionRepository.save(
				creation
			);
		}
		return creation;
	}
}
