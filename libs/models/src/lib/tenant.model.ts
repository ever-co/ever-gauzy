export interface ITenant {
	id?: string;
	name?: string;

	readonly createdAt?: Date;
	readonly updatedAt?: Date;

	// organizations?: IOrganization[];
}

export interface ITenantCreateInput {
	name: string;
}
