export interface IPagination<T> {
	page: number;
	limit: number;
	filter?: T;
	sortBy?: keyof T;
}

export interface IPaginationResult<T> {
	total: number;
	data: T[];
}
