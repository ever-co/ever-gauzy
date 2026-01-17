import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

/**
 * Query to find all organization strategic initiatives linked to a specific project.
 */
export class OrganizationStrategicInitiativeFindByProjectQuery implements IQuery {
	static readonly type = '[OrganizationStrategicInitiative] Find By Project';

	constructor(public readonly projectId: ID) {}
}
