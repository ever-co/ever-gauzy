import { User } from '..';
import { Organization } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Employee extends IBaseEntityModel {
    user: User;
    userId: string;
    organization: Organization;
    orgId: string;
    valueDate?: Date;
}