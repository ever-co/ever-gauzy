import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Role extends IBaseEntityModel {
    name: string;
}

export enum RolesEnum {
    ADMIN = 'ADMIN',
    DATA_ENTRY = 'DATA_ENTRY',
    EMPLOYEE = 'EMPLOYEE'
}
