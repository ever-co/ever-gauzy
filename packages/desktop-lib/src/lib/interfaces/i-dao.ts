export interface DAO<T> {
	findAll(): Promise<T[]>;
	save(value: T): Promise<void>;
	findOneById(id: number): Promise<T>;
	update(id: number | string, value: Partial<T>): Promise<void>;
	delete(value: Partial<T>): Promise<void>;
	saveAndReturn?(value: T): Promise<T>;
}
