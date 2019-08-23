import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Organization extends IBaseEntityModel {
    name: string;
    valueDate?: Date;
    imageUrl?: string;
    currency: string;
    defaultValueDateType: string;
}

export interface OrganizationFindInput extends IBaseEntityModel {
    name?: string;
    valueDate?: Date;
    imageUrl?: string;
    currency?: CurrenciesEnum;
}

export interface OrganizationCreateInput {
    name: string;
    valueDate?: Date;
    imageUrl: string;
    currency: CurrenciesEnum;
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

export enum DefaultValueDateTypeEnum {
    TODAY = 'TODAY',
    END_OF_MONTH = 'END_OF_MONTH',
    START_OF_MONTH = 'START_OF_MONTH'
}