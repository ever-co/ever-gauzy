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

export enum CurrenciesEnum {
    USD = 'USD',
    BGN = 'BGN',
    ILS = 'ILS'
}