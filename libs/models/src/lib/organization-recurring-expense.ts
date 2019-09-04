import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface OrganizationRecurringExpense extends IBaseEntityModel {
    orgId: string;
    categoryName: string;
    value: number;
    currency: string;
}

export interface OrganizationRecurringExpenseFindInput extends IBaseEntityModel {
    orgId?: string;
    categoryName?: string;
    value?: number;
    currency?: string;
}