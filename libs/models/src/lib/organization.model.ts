import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Organization extends IBaseEntityModel {
    name: string;
    valueDate?: Date;
    imageUrl?: string;
    currency: string;
}

export interface OrganizationFindInput extends IBaseEntityModel {
    name?: string;
    valueDate?: Date;
    imageUrl?: string;
    currency?: string;
}

export enum OrganizationSelectInput {
    id = 'id',
    name = 'name',
    valueDate = 'valueDate',
    imageUrl = 'imageUrl',
    currency = 'currency',
    createdAt = 'createdAt',
    updatedAt = 'updatedAt',
}

export enum CurrenciesEnum {
    USD = 'USD',
    BGN = 'BGN',
    ILS = 'ILS'
}