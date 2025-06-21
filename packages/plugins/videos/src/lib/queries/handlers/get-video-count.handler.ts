import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { GetVideoCountQuery } from '../get-video-count.query';
import { RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';

/**
 * Handler for the `GetVideoCountQuery` that retrieves the count of video entities
 * based on the provided query parameters and user permissions.
 */
@QueryHandler(GetVideoCountQuery)
export class GetVideoCountQueryHandler implements IQueryHandler<GetVideoCountQuery> {
	/**
	 * Constructs the `GetVideoCountQueryHandler`.
	 *
	 * @param videosService - The service responsible for video-related operations.
	 */
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Executes the `GetVideoCountQuery` to retrieve the count of video entities.
	 *
	 * Validates the query, checks user permissions, builds appropriate where conditions,
	 * and returns the count of matching video records.
	 *
	 * @param query - The `GetVideoCountQuery` containing the query options.
	 * @returns A Promise that resolves to the count of video entities.
	 * @throws {BadRequestException} If query options are invalid or required parameters are missing.
	 */
	async execute(query: GetVideoCountQuery): Promise<number> {
		// Validate the query parameters
		this.validateQuery(query);

		// Extract required parameters from query options
		const { organizationId, tenantId } = query.options;

		// Check if user has permission to view all videos or just their own
		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Build where conditions based on permissions and query parameters
		const whereConditions = this.buildWhereConditions(organizationId, tenantId, hasPermission);

		// Return the count of videos matching the conditions
		return this.videosService.count({ where: whereConditions });
	}

	/**
	 * Validates the query parameters to ensure all required fields are present.
	 *
	 * @param query - The `GetVideoCountQuery` to validate.
	 * @throws {BadRequestException} If any required parameter is missing.
	 */
	private validateQuery(query: GetVideoCountQuery): void {
		if (!query?.options) {
			throw new BadRequestException('Query options are required');
		}

		if (!query.options.organizationId) {
			throw new BadRequestException('Organization ID is required');
		}

		if (!query.options.tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}
	}

	/**
	 * Builds the where conditions for the video count query based on organization,
	 * tenant, and user permissions.
	 *
	 * @param organizationId - The ID of the organization to filter videos by.
	 * @param tenantId - The ID of the tenant to filter videos by.
	 * @param hasPermission - Boolean indicating if user has permission to view all videos.
	 * @returns An object containing the where conditions for the query.
	 * @throws {BadRequestException} If current employee ID cannot be determined for restricted access.
	 */
	private buildWhereConditions(
		organizationId: string,
		tenantId: string,
		hasPermission: boolean
	): Record<string, any> {
		// Base conditions that always apply
		const conditions: Record<string, any> = {
			organizationId,
			tenantId
		};

		// If user doesn't have permission to view all videos, restrict to their own uploads
		if (!hasPermission) {
			const currentEmployeeId = RequestContext.currentEmployeeId();
			if (!currentEmployeeId) {
				throw new BadRequestException('Unable to determine current employee');
			}
			conditions.uploadedById = currentEmployeeId;
		}

		return conditions;
	}
}
