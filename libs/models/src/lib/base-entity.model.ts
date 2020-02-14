export interface BaseEntityModel {
	id?: string;
	tenantId?: string;

	readonly createdAt?: Date;
	readonly updatedAt?: Date;
}
