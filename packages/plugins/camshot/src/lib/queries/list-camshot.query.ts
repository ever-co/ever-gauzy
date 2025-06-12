import { IQuery } from "@nestjs/cqrs";
import { BaseQueryDTO } from "@gauzy/core";
import { ICamshot } from "../models/camshot.model";

export class ListCamshotQuery implements IQuery {
	public static readonly type = '[Camshot] List';
	/**
	 * Query to fetch paginated list of camshots
	 *
	 * @description This query is used to retrieve a paginated list of camshots with optional filtering and sorting
	 * @param params - Pagination and filtering parameters for camshots
	 */
	constructor(public readonly params: BaseQueryDTO<ICamshot>) { }
}
