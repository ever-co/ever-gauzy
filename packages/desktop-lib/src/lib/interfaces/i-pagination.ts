export interface IPagination<T> {
	page: number;
	limit: number;
	filter?: Partial<T>;
	sortBy?: Extract<keyof T, string>;
}

export interface IPaginationResult<T> {
	total: number;
	data: T[];
}
