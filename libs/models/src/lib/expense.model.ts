import { Employee } from './employee.model';
import { Organization } from './organization.model';

export interface Expense {
    id?: string;
    employee: Employee;
    employeeId: string;
    organization: Organization;
    orgId: string;
    amount: number;
    vendorName: string;
    vendorId?: string;
    categoryName: string;
    categoryId?: string;
    notes?: string;
    valueDate?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}