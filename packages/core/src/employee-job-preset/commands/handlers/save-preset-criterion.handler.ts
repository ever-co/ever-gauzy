import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestContext } from '../../../core/context';
import { Employee } from '../../../employee/employee.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler implements ICommandHandler<SavePresetCriterionCommand> {

	constructor(
		@InjectRepository(Employee)
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) { }

	public async execute(
		command: SavePresetCriterionCommand
	): Promise<IMatchingCriterions> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.typeOrmEmployeeRepository.findOneBy({
				id: user.employeeId
			});
			input.organizationId = employee.organizationId;
		}
		input.tenantId = tenantId;

		const creation = new JobPresetUpworkJobSearchCriterion(input);
		await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.save(creation);
		return creation;
	}
}
