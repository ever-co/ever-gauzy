import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as moment from 'moment-timezone';
import { Between, In } from 'typeorm';
import { VideosService } from '../../services/videos.service';
import { IVideo } from '../../video.model';
import { GetVideosQuery } from '../get-videos.query';

@QueryHandler(GetVideosQuery)
export class GetVideosQueryHandler implements IQueryHandler<GetVideosQuery> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `GetVideosQuery` to retrieve a paginated list of video entities.
	 *
	 * @param query - The `GetVideosQuery` containing parameters for pagination and filtering.
	 *
	 * @returns A promise resolving to a paginated result (`IPagination<IVideo>`), including a list of videos and metadata.
	 */
	public async execute(query: GetVideosQuery): Promise<IPagination<IVideo>> {
		// Extract pagination and filter parameters from the query
		const { params } = query;

		const {
			startDate,
			endDate,
			tenantId,
			organizationId,
			employeeIds = [],
			timeZone = 'UTC'
		} = (params || {}) as any;

		// Build the dynamic WHERE clause for the query
		const where: Record<string, any> = {
			tenantId,
			organizationId
		};

		// Add recordedAt only if startDate and endDate are provided
		if (startDate && endDate) {
			// Convert startDate and endDate to UTC based on the provided timeZone
			const startDateUtc = moment.tz(startDate, timeZone).utc().toDate();
			const endDateUtc = moment.tz(endDate, timeZone).utc().toDate();
			// Update the 'valueDate' property to filter records between the specified dates
			where.recordedAt = Between(startDateUtc, endDateUtc);
		}

		// Add employee filter only if employeeIds is provided and non-empty
		if (employeeIds.length > 0) {
			where.uploadedById = In(employeeIds);
		}

		// Fetch paginated videos from the service
		return this.videosService.paginate({
			...params,
			where
		});
	}
}
