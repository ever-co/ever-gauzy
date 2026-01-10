import { IBasePerEntityType, JsonData, OmitFields } from "./base-entity.model";

export interface ISharedEntity extends IBasePerEntityType {
    readonly token: string;
    shareRules: IShareRule | string; // Essentially stores entity fields and relations that are shared
    sharedOptions?: JsonData; // Stores additional options for the shared entity
}

export interface IShareRule {
    fields: string[];
    relations?: Record<string, IShareRule> | string;
}

export interface ISharedEntityCreateInput extends OmitFields<ISharedEntity, 'token'> {}

export interface ISharedEntityFindInput extends Partial<ISharedEntity> {}

export interface ISharedEntityUpdateInput extends Partial<OmitFields<ISharedEntity, 'token' | 'entity' | 'entityId'>> {}
