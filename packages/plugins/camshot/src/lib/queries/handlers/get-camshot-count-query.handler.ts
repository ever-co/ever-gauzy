import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { GetCamshotCountQuery } from '../get-camshot-count.query';
import { CamshotService } from '../../services/camshot.service';

/**
 * Query handler for retrieving the count of camshot entities.
 *
 * This handler processes the `GetCamshotCountQuery` to count the number of camshot entities
 * based on the provided query options.
 */
@QueryHandler(GetCamshotCountQuery)
export class GetCamshotCountQueryHandler implements IQueryHandler<GetCamshotCountQuery> {
	constructor(private readonly camshotService: CamshotService) { }

	/**
	 * Handles the `GetCamshotCountQuery` to retrieve the count of camshot entities.
	 *
	 * @param query - The `GetCamshotCountQuery` containing the filter options for counting camshot entities.
	 *
	 * @returns A promise resolving to the count of camshot entities (`number`).
	 *
	 */
	public async execute(query: GetCamshotCountQuery): Promise<number> {
		// Destructure the query to extract the camshot ID and options
		const { options } = query || {};
		// Fetch the camshot entity from the database
		const { organizationId, tenantId } = options;
		// Check if the current user has the permission
		const permission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		// Fetch the count of camshot entities from the database
		return this.camshotService.count({
			where: {
				...(!permission && { uploadedById: RequestContext.currentEmployeeId() }),
				organizationId,
				tenantId
			}
		});
	}
}
