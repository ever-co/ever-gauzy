import { Employee } from './employee.model';
import { Organization } from './organization.model';

export interface Income {
    id?: string;
    employee: Employee;
    employeeId: string;
    organization: Organization;
    orgId: string;
    amount: number;
    clientId?: string;
    clientName: string;
    valueDate?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}
