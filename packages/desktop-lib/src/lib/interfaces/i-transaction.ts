export interface ITransaction<T> {
	create(value: T): Promise<void>;
	update(id: number, value: Partial<T>): Promise<void>;
}
