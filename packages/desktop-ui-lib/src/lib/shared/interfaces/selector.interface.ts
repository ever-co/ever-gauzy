import { IPaginationInput } from '@gauzy/contracts';

export interface ISelector<T> extends IPaginationInput {
	hasPermission: boolean;
	total: number;
	selected: T;
	data: T[];
}
