import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmployeeSettings extends IBaseEntityModel {
    employeeId: string;
    month: number;
    year: number;
    settingType: string;
    value: number;
    valueDate?: Date;
}