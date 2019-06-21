import { Employee } from './employee.model';
import { Organization } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Expense extends IBaseEntityModel {
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
}