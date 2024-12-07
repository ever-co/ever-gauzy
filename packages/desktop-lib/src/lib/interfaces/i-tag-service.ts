export interface tagService<T> {
	findAll(): Promise<T>;
	save(tag: T): Promise<void>;
    bulkSave(tag: T[]): Promise<void>;
    remove(tag: Partial<T>): Promise<void>;
}
