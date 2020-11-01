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
