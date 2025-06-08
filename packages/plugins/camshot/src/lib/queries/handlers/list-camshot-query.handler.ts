import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ListCamshotQuery } from "../list-camshot.query";
import { CamshotService } from "../../services/camshot.service";
import { ICamshot } from "../../models/camshot.model";
import { IPagination } from "@gauzy/contracts";
import { Injectable } from "@nestjs/common";

@Injectable()
@QueryHandler(ListCamshotQuery)
export class ListCamshotQueryHandler implements IQueryHandler<ListCamshotQuery> {
	constructor(private readonly camshotService: CamshotService) { }

	/**
	 * Handles the ListCamshotQuery and returns a paginated list of camshots.
	 *
	 * @param query - The query containing pagination and filtering parameters for camshots
	 * @returns Promise<IPagination<ICamshot>> A paginated list of camshots
	 */
	public async execute(query: ListCamshotQuery): Promise<IPagination<ICamshot>> {
		const { params = {} } = query;
		return this.camshotService.findAll(params);
	}
}
