import { IEmployee } from '@gauzy/contracts';
import { BaseTO } from './base.dto';

export interface UserTO extends BaseTO {
	email: string;
	employee: Partial<IEmployee>;
	employeeId: string;
	name: string;
}
export const TABLE_NAME_USERS = 'users';
