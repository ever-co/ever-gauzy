import { ITaskFilterOption } from './i-task-filter-option';

export interface ITaskService<T> {
	save(task: T): Promise<void>;
	findAll(): Promise<T[]>;
	findById(task: Partial<T>): Promise<T>;
	findByOption(options: ITaskFilterOption): Promise<T[]>;
    remove(task: Partial<T>): Promise<void>;
}
