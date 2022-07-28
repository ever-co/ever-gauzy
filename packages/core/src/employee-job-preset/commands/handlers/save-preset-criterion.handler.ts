import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context';
import { Employee } from '../../../employee/employee.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler
	implements ICommandHandler<SavePresetCriterionCommand> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>
	) {}

	public async execute(
		command: SavePresetCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOneBy({
				id: user.employeeId
			});
			input.organizationId = employee.organizationId;
		}
		input.tenantId = tenantId;

		const creation = new JobPresetUpworkJobSearchCriterion(input);
		await this.jobPresetUpworkJobSearchCriterionRepository.save(creation);
		return creation;
	}
}
