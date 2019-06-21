import { Employee } from './employee.model';

export interface EmployeeSettings {
    id?: string;
    employeeId: string;
    month: number;
    year: number;
    settingType: string;
    value: number;
    valueDate?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}