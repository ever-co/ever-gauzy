import { PlainObject } from './collection.types';

/**
 *	Base class for collections
 */
export class BaseCollection<T extends PlainObject> {
	private data: T;

	constructor(data: T) {
		this.data = data;
	}

	// Method to convert plain object data to class instance
	public static toClass<T extends PlainObject, U extends BaseCollection<T>>(
		this: new (data: T) => U,
		plainData: T
	): U {
		return new this(plainData);
	}

	// Method to convert class instance to plain object data
	public toPlain(): T {
		return { ...this.data };
	}

	// Method to convert class instance to JSON string
	public toJSON(): string {
		return JSON.stringify(this.toPlain());
	}

	// Getter to return the data directly
	public get entity(): T {
		return this.data;
	}
}
