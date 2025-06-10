import {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ISoundshot as ISoundshotContract,
	ID,
	IRelationalUser,
	ITimeSlot
} from "@gauzy/contracts";

export interface ISoundshot extends ISoundshotContract,
	IBasePerTenantAndOrganizationEntityModel,
	IRelationalUser {
	fileKey?: string;
	timeSlotId?: ID;
	timeSlot?: ITimeSlot;
	storageProvider: FileStorageProviderEnum;
}
