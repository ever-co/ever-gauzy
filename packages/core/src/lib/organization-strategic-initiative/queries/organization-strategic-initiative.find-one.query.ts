import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '../../core/crud';
import { OrganizationStrategicInitiative } from '../organization-strategic-initiative.entity';

/**
 * Query to find a single organization strategic initiative by ID.
 */
export class OrganizationStrategicInitiativeFindOneQuery implements IQuery {
	static readonly type = '[OrganizationStrategicInitiative] Find One';

	constructor(
		public readonly id: ID,
		public readonly options?: BaseQueryDTO<OrganizationStrategicInitiative>
	) {}
}
