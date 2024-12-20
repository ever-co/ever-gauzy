import { IClientFilterOption } from "./i-client-filter-option";

export interface IProjectService<T> {
	save(project: T): Promise<void>;
	findAll(): Promise<T[]>;
	findOne(project: Partial<T>): Promise<T>;
	findByClient(options: IClientFilterOption): Promise<T[]>;
	remove(project: Partial<T>): Promise<void>;
}
