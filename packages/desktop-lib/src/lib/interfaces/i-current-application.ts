import {Serializable} from "./serializable";
import {IDataApplication} from "./i-data-application";

export interface ICurrentApplication extends Serializable<Object> {

	get duration(): number;

	set duration(value: number);

	get timestamp(): string;

	set timestamp(value: string);

	get data(): IDataApplication;

	set data(value: IDataApplication);
}
