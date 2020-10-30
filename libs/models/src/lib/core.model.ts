export interface IPaginationInput {
	limit?: number;
	page?: number;
}

export interface IPagination<T> {
	count: number;
	items: T[];
}
