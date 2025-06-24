import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCamshotQuery } from '../get-camshot.query';
import { ICamshot } from '../../models/camshot.model';
import { CamshotService } from '../../services/camshot.service';

@QueryHandler(GetCamshotQuery)
export class GetCamshotQueryHandler implements IQueryHandler<GetCamshotQuery> {
	constructor(private readonly camshotService: CamshotService) { }

	/**
	 * Handles the `GetCamshotQuery` to retrieve a camshot entity by its ID.
	 *
	 * @param query - The `GetCamshotQuery` containing the ID of the camshot to be fetched and optional query options.
	 *
	 * @returns A promise resolving to the camshot entity (`ICamshot`) if found.
	 *
	 * @throws {NotFoundException} If the camshot with the specified ID is not found.
	 */
	public async execute(query: GetCamshotQuery): Promise<ICamshot> {
		// Destructure the query to extract the camshot ID and options
		const { id, options = {} } = query;

		// Step 1: Fetch the camshot entity from the database
		const camshot = await this.camshotService.findOneByIdString(id, options);

		// Step 2: Throw a NotFoundException if the camshot does not exist
		if (!camshot) {
			throw new NotFoundException(`Camshot with ID ${id} not found.`);
		}

		// Step 3: Return the camshot entity
		return camshot;
	}
}
