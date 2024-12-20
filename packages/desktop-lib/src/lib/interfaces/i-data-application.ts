import {Serializable} from "./serializable";

export interface IDataApplication extends Serializable<Object> {
	get title(): string;

	set title(value: string);

	get executable(): string;

	set executable(value: string);

	get name(): string;

	set name(value: string);

	get url(): string;

	set url(value: string);
}
