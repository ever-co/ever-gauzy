import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Query to get all user assignments for a plugin installation
 */
export class GetPluginUserAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get Plugin User Assignments';

	constructor(
		public readonly pluginInstallationId: ID,
		public readonly includeInactive: boolean = false,
		public readonly take?: number,
		public readonly skip?: number
	) {}
}

/**
 * Query to get all plugin assignments for a user
 */
export class GetUserPluginAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get User Plugin Assignments';

	constructor(
		public readonly userId: ID,
		public readonly includeInactive: boolean = false,
		public readonly take?: number,
		public readonly skip?: number
	) {}
}

/**
 * Query to check if a user has access to a specific plugin installation
 */
export class CheckUserPluginAccessQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Check User Plugin Access';

	constructor(public readonly pluginInstallationId: ID, public readonly userId: ID) {}
}

/**
 * Query to get all plugin user assignments with optional filters
 */
export class GetAllPluginUserAssignmentsQuery implements IQuery {
	public static readonly type = '[Plugin User Assignment] Get All Plugin User Assignments';

	constructor(
		public readonly filters?: {
			pluginId?: ID;
			userId?: ID;
			assignedById?: ID;
			isActive?: boolean;
		}
	) {}
}
