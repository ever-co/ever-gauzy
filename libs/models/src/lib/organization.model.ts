import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Organization extends IBaseEntityModel {
    name: string;
    valueDate?: Date;
}
