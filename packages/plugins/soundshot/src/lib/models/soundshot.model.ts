import {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	IRelationalUser,
	ISoundshot as ISoundshotContract,
	ITimeSlot
} from '@gauzy/contracts';

export interface ISoundshot extends ISoundshotContract, IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	fileKey?: string;
	timeSlotId?: ID;
	timeSlot?: ITimeSlot;
	storageProvider: FileStorageProviderEnum;
}
