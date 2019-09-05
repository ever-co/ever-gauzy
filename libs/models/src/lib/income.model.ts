import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Income extends IBaseEntityModel {
    employee?: Employee;
    employeeId?: string;
    organization: Organization;
    orgId: string;
    amount: number;
    clientId?: string;
    clientName: string;
    currency: string;
    valueDate?: Date;
    notes?: string;
}

export interface IncomeCreateInput {
    amount: number;
    clientName: string;
    clientId: string;
    valueDate: Date;
    currency?: string;
    employeeId?: string;
    notes?: string;
}

export interface IncomeUpdateInput {
    amount?: number;
    clientName?: string;
    clientId?: string;
    valueDate?: Date;
    employeeId?: string;
    currency?: string;
    notes?: string;
}

export interface IncomeFindInput extends IBaseEntityModel {
    employee?: EmployeeFindInput;
    organization?: OrganizationFindInput;
    amount?: number;
    clientId?: string;
    clientName?: string;
    valueDate?: Date;
    currency?: string;
}