import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface EmployeeSetting extends IBaseEntityModel {
    employeeId: string;
    month: number;
    year: number;
    settingType: string;
    value: number;
    currency: string;
  organization?: Organization;
  tenant: ITenant;
}

export interface EmployeeSettingFindInput extends IBaseEntityModel {
    employeeId?: string;
    month?: number;
    year?: number;
    currency?: string;
}
