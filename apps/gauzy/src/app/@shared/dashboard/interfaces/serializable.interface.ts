export interface Serializable<T> {
	serialize(values: T[]): void;
	deSerialize(): Partial<T>[];
}
