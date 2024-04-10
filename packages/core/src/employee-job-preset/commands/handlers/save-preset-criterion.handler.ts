import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '../../../core/context';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler implements ICommandHandler<SavePresetCriterionCommand> {

	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: SavePresetCriterionCommand): Promise<IMatchingCriterions> {
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
