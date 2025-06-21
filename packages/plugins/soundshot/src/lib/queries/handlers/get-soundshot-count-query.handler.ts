import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { GetSoundshotCountQuery } from '../get-soundshot-count.query';
import { SoundshotService } from '../../services/soundshot.service';

/**
 * Query handler for retrieving the count of soundshot entities.
 *
 * This handler processes the `GetSoundshotCountQuery` to count the number of soundshot entities
 * based on the provided query options.
 */
@QueryHandler(GetSoundshotCountQuery)
export class GetSoundshotCountQueryHandler implements IQueryHandler<GetSoundshotCountQuery> {
	constructor(private readonly soundshotService: SoundshotService) { }

	/**
	 * Handles the `GetSoundshotCountQuery` to retrieve the count of soundshot entities.
	 *
	 * @param query - The `GetSoundshotCountQuery` containing the filter options for counting soundshot entities.
	 *
	 * @returns A promise resolving to the count of soundshot entities (`number`).
	 *
	 */
	public async execute(query: GetSoundshotCountQuery): Promise<number> {
		// Destructure the query to extract the soundshot ID and options
		const { options } = query || {};
		// Fetch the soundshot entity from the database
		const { organizationId, tenantId } = options;
		// Check if the current user has the permission
		const permission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// If permission is not available and current employee ID is missing, return 0
		if (!permission && !RequestContext.currentEmployeeId()) {
			return 0;
		}

		// Fetch the count of soundshot entities from the database
		return this.soundshotService.count({
			where: {
				...(!permission && { uploadedById: RequestContext.currentEmployeeId() }),
				organizationId,
				tenantId
			}
		});
	}
}
