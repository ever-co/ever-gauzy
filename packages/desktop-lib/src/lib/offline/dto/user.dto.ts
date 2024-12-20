import { BaseTO } from './base.dto';
import { EmployeeTO } from './employee.dto';

export interface UserTO extends BaseTO {
	email: string;
	employee: Partial<EmployeeTO>;
	employeeId: string;
	name: string;
}
export const TABLE_NAME_USERS = 'users';
