import { IQuery } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiativeFindInput } from '@gauzy/contracts';
import { BaseQueryDTO } from '../../core/crud';
import { OrganizationStrategicInitiative } from '../organization-strategic-initiative.entity';

/**
 * Query to find all organization strategic initiatives with optional filters.
 */
export class OrganizationStrategicInitiativeFindAllQuery implements IQuery {
	static readonly type = '[OrganizationStrategicInitiative] Find All';

	constructor(
		public readonly options?: BaseQueryDTO<OrganizationStrategicInitiative> & IOrganizationStrategicInitiativeFindInput
	) {}
}
