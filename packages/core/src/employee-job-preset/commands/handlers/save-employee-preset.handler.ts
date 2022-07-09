import { GauzyAIService } from '@gauzy/integration-ai';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Employee } from '../../../employee/employee.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { SaveEmployeePresetCommand } from '../save-employee-preset.command';

@CommandHandler(SaveEmployeePresetCommand)
export class SaveEmployeePresetHandler
	implements ICommandHandler<SaveEmployeePresetCommand> {
	constructor(
		private readonly gauzyAIService: GauzyAIService,

		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>
	) {}

	public async execute(
		command: SaveEmployeePresetCommand
	): Promise<JobPreset[]> {
		const { input } = command;
		const [employee] = await this.employeeRepository.find({
			where: {
				id: input.employeeId
			},
			relations: {
				jobPresets: true
			}
		});
		const [jobPreset] = await this.jobPresetRepository.find({
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
		this.employeeRepository.save(employee);

		await this.employeeUpworkJobsSearchCriterionRepository.delete({
			employeeId: input.employeeId
		});

		await this.employeeUpworkJobsSearchCriterionRepository.save(
			employeeCriterions
		);

		this.gauzyAIService.syncGauzyEmployeeJobSearchCriteria(
			employee,
			employeeCriterions
		);

		return employeeCriterions;
	}
}
