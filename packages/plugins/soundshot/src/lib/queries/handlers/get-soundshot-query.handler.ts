import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetSoundshotQuery } from '../get-soundshot.query';
import { ISoundshot } from '../../models/soundshot.model';
import { SoundshotService } from '../../services/soundshot.service';

@QueryHandler(GetSoundshotQuery)
export class GetSoundshotQueryHandler implements IQueryHandler<GetSoundshotQuery> {
	constructor(private readonly soundshotService: SoundshotService) { }

	/**
	 * Handles the `GetSoundshotQuery` to retrieve a soundshot entity by its ID.
	 *
	 * @param query - The `GetSoundshotQuery` containing the ID of the soundshot to be fetched and optional query options.
	 *
	 * @returns A promise resolving to the soundshot entity (`ISoundshot`) if found.
	 *
	 * @throws {NotFoundException} If the soundshot with the specified ID is not found.
	 */
	public async execute(query: GetSoundshotQuery): Promise<ISoundshot> {
		// Destructure the query to extract the soundshot ID and options
		const { id, options = {} } = query;

		// Step 1: Fetch the soundshot entity from the database
		const soundshot = await this.soundshotService.findOneByIdString(id, options);

		// Step 2: Throw a NotFoundException if the soundshot does not exist
		if (!soundshot) {
			throw new NotFoundException(`Soundshot with ID ${id} not found.`);
		}

		// Step 3: Return the soundshot entity
		return soundshot;
	}
}
