export interface IProjectService<T> {
	save(project: T): Promise<void>;
	findAll(): Promise<T[]>;
	findOne(project: Partial<T>): Promise<T>;
	findByClient(clientId: number, externalClientId?: string): Promise<T[]>;
	remove(project: Partial<T>): Promise<void>;
}
