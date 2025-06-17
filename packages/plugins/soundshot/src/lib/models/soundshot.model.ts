import {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	IEmployee,
	IRelationalUser,
	ISoundshot as ISoundshotContract,
	ITimeSlot
} from '@gauzy/contracts';

export interface ISoundshot extends ISoundshotContract, IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	fileKey?: string;
	timeSlotId?: ID;
	timeSlot?: ITimeSlot;
	uploadedById?: ID;
	uploadedBy?: IEmployee;
	storageProvider: FileStorageProviderEnum;
}
