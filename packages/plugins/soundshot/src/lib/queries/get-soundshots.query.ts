import { IQuery } from '@nestjs/cqrs';
import { GetSoundshotsQueryDTO } from '../dtos/get-soundshots-query.dto';

export class GetSoundshotsQuery implements IQuery {
	public static readonly type = '[Soundshot] Get Many';
	/**
	 * Query to fetch paginated list of soundshots
	 *
	 * @description This query is used to retrieve a paginated list of soundshots with optional filtering and sorting
	 * @param params - Pagination and filtering parameters for soundshots
	 */
	constructor(public readonly params: GetSoundshotsQueryDTO) {}
}
