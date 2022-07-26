export interface Serializable<T> {
	serialize(): Partial<T>[] | void;
	deSerialize(): Partial<T>[];
	deSerialize(store?: Partial<T>[], values?: Partial<T>[]): Partial<T>[];
}
