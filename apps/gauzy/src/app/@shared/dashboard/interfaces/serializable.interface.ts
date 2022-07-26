export interface Serializable<T> {
	serialize(): void;
	deSerialize(): Partial<T>[];
	serialize(size?: number): Partial<T>[];
	deSerialize(store?: Partial<T>[], values?: Partial<T>[]): Partial<T>[];
}
