import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as moment from 'moment-timezone';
import { Between, In } from 'typeorm';
import { ISoundshot } from '../../models/soundshot.model';
import { SoundshotService } from '../../services/soundshot.service';
import { GetSoundshotsQuery } from '../get-soundshots.query';

@Injectable()
@QueryHandler(GetSoundshotsQuery)
export class GetSoundshotsQueryHandler implements IQueryHandler<GetSoundshotsQuery> {
	constructor(private readonly soundshotService: SoundshotService) {}

	/**
	 * Handles the GetSoundshotsQuery and returns a paginated list of soundshots.
	 *
	 * @param query - The query containing pagination and filtering parameters for soundshots
	 * @returns Promise<IPagination<ISoundshot>> A paginated list of soundshots
	 */
	public async execute(query: GetSoundshotsQuery): Promise<IPagination<ISoundshot>> {
		// Extract pagination and filter parameters from the query
		const { params } = query;

		const { startDate, endDate, tenantId, organizationId, employeeIds = [], timeZone = 'UTC' } = params;

		// Build the dynamic WHERE clause for the query
		const where: Record<string, any> = {
			tenantId,
			organizationId
		};

		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		// If the current user doesn't have the permission to select employee, filter by uploadedById
		if (!hasPermission) {
			// If current employee ID is missing, return empty pagination result
			if (!RequestContext.currentEmployeeId()) {
				return { items: [], total: 0 };
			}
			where.uploadedById = RequestContext.currentEmployeeId();
		}

		// Add recordedAt only if startDate and endDate are provided
		if (startDate && endDate) {
			// Convert startDate and endDate to UTC based on the provided timeZone
			const startDateUtc = moment.tz(startDate, timeZone).utc().toDate();
			const endDateUtc = moment.tz(endDate, timeZone).utc().toDate();
			// Update the 'recordedAt' property to filter records between the specified dates
			where.recordedAt = Between(startDateUtc, endDateUtc);
		}

		// Add employee filter only if employeeIds is provided and non-empty
		if (employeeIds.length > 0 && hasPermission) {
			where.uploadedById = In(employeeIds);
		}

		// Fetch paginated soundshots from the service
		return this.soundshotService.paginate({
			...params,
			where: { ...where, ...params.where },
			withDeleted: true
		});
	}
}
