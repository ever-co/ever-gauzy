export interface IPaginationInput {
	limit?: number;
	page?: number;
}

export interface IPagination<T> {
	/**
	 * Items included in the current listing
	 */
	readonly items: T[];

	/**
	 * Total number of available items
	 */
	readonly total: number;
}

/*
 * Common query parameter
 */
export interface IListQueryInput<T> {
	/**
	 * Model entity defined relations
	 */
	readonly relations?: string[];
	readonly findInput?: T | any;
	readonly where?: any;
}
