import { IBasePerTenantEntityModel } from "./base-entity.model";

export interface IImportRecord extends IBasePerTenantEntityModel {
	entityType: string;
	sourceId: string;
	destinationId : string;
	importDate: Date;
}

export interface IImportHistory extends IBasePerTenantEntityModel {
	file: string;
	size: string;
	status: string;
	importDate: Date;
}

export interface IEntityModel {
	name: string;
	value: string;
	checked: boolean;
	isGroup: boolean;
	entities: IEntityModel[];
}