export interface IPaginationInput {
	limit?: number;
	page?: number;
}

export interface Pagination<T> {
	count: number;
	items: T[];
}
