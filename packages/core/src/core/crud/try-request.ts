export interface ITryRequest<T> {
	success: boolean;
	record?: T;
	error?: any;
}
