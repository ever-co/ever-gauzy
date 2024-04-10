import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/integration-ai';
import { In } from 'typeorm';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { SaveEmployeePresetCommand } from '../save-employee-preset.command';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';

@CommandHandler(SaveEmployeePresetCommand)
export class SaveEmployeePresetHandler implements ICommandHandler<SaveEmployeePresetCommand> {
	constructor(
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly gauzyAIService: GauzyAIService
	) { }

	public async execute(
		command: SaveEmployeePresetCommand
	): Promise<JobPreset[]> {
		const { input } = command;
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: {
				id: input.employeeId
			},
			relations: {
				jobPresets: true,
				organization: true
			}
		});
		const jobPreset = await this.typeOrmJobPresetRepository.findOne({
			where: {
				id: In(input.jobPresetIds)
			},
			relations: {
				jobPresetCriterions: true
			}
		});
		const employeeCriterions = jobPreset.jobPresetCriterions.map((item) => {
			return new EmployeeUpworkJobsSearchCriterion({
				...item,
				employeeId: input.employeeId
			});
		});

		employee.jobPresets = input.jobPresetIds.map(
			(id) => new JobPreset({ id })
		);
		this.typeOrmEmployeeRepository.save(employee);

		await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.delete({
			employeeId: input.employeeId
		});

		await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(
			employeeCriterions
		);

		this.gauzyAIService.syncGauzyEmployeeJobSearchCriteria(
			employee,
			employeeCriterions
		);

		return employeeCriterions;
	}
}
