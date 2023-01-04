export interface IUserService<T> {
	save(user: T): Promise<void>;
	retrieve(): Promise<T>;
	remove(user: T): Promise<void>;
	update(user: Partial<T>): Promise<void>;
}
