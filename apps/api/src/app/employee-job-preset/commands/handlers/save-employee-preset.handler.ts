import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../../employee/employee.entity';
import { JobPreset } from '../../job-preset.entity';
import { SaveEmployeePresetCommand } from '../save-employee-preset.command';

@CommandHandler(SaveEmployeePresetCommand)
export class SaveEmployeePresetHandler
	implements ICommandHandler<SaveEmployeePresetCommand> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(
		command: SaveEmployeePresetCommand
	): Promise<JobPreset[]> {
		const { input } = command;

		const employee = await this.employeeRepository.findOne(
			input.employeeId,
			{
				relations: ['jobPresets']
			}
		);

		const jobPreset = input.jobPresetIds.map((id) => new JobPreset({ id }));
		employee.jobPresets = jobPreset;
		this.employeeRepository.save(employee);

		return employee.jobPresets;
	}
}
