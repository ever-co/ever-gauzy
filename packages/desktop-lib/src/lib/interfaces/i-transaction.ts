export interface ITransaction<T> {
	create(value: T): Promise<void>;
	createAndReturn?(value: T): Promise<T>;
	update(id: number, value: Partial<T>): Promise<void>;
	updatePartial?(key: number | string, value: Partial<T>): Promise<T>;
}
