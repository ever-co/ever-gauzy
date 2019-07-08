import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Income extends IBaseEntityModel {
    employee: Employee;
    employeeId: string;
    organization: Organization;
    orgId: string;
    amount: number;
    clientId?: string;
    clientName: string;
    valueDate?: Date;
}

export interface IncomeCreateInput {
    amount: number;
    clientName: string;
    clientId: string;
    valueDate: Date;
    employeeId: string;
}

export interface IncomeFindInput extends IBaseEntityModel {
    employee?: EmployeeFindInput;
    organization?: OrganizationFindInput;
    amount?: number;
    clientId?: string;
    clientName?: string;
    valueDate?: Date;
}