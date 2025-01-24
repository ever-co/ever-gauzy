import {
	FileStorageProvider,
	IBasePerTenantAndOrganizationEntityModel,
	ITimeSlot,
	IEmployee,
	ID
} from '@gauzy/contracts';

export interface IVideo extends IBasePerTenantAndOrganizationEntityModel {
	// Core video properties
	title: string;
	file: string;
	recordedAt?: Date;
	duration?: number;
	size?: number;
	fullUrl?: string | null;

	// Storage and description
	storageProvider?: FileStorageProvider;
	description?: string;

	// Metadata properties
	resolution?: string; // e.g., '1920x1080' or '1080p'
	codec?: string;
	frameRate?: number; // e.g., 30, 60

	// Time slot association
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;

	// Uploader reference
	uploadedBy?: IEmployee;
	uploadedById?: ID;
}
