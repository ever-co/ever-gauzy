import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmployeeSetting extends IBaseEntityModel {
    employeeId: string;
    month: number;
    year: number;
    settingType: string;
    value: number;
    currency: string;
}

export interface EmployeeSettingFindInput extends IBaseEntityModel {
    employeeId?: string;
    month?: number;
    year?: number;
    currency?: string;
}