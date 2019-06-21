import { Employee } from './employee.model';
import { Organization } from './organization.model';
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
