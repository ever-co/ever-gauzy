import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Query to get plugin user assignments
 */
export class GetPluginUserAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get Plugin User Assignments';

	constructor(
		public readonly pluginId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly skip?: number,
		public readonly take?: number
	) {}
}

/**
 * Query to get user plugin assignments
 */
export class GetUserPluginAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get User Plugin Assignments';

	constructor(
		public readonly userId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly skip?: number,
		public readonly take?: number
	) {}
}

/**
 * Query to check user plugin access
 */
export class CheckUserPluginAccessQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Check User Plugin Access';

	constructor(
		public readonly pluginId: ID,
		public readonly userId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID
	) {}
}

/**
 * Query to get all plugin user assignments
 */
export class GetAllPluginUserAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get All Plugin User Assignments';

	constructor(
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly skip?: number,
		public readonly take?: number
	) {}
}
