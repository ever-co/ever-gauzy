export interface Serializable<T> {
	serialize(): void;
	deSerialize(): Partial<T>[];
	toObject(values: T[]): Partial<T>[];
}
