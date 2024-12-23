import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { FileStorageProvider } from './file-provider';
import { IDeleteEntity, ITimeSlot } from './timesheet.model';

export interface IVideo extends IBasePerTenantAndOrganizationEntityModel {
	// Core video properties
	title: string;
	file: string;
	recordedAt?: Date;
	duration?: number;
	size?: number;
	fullUrl?: string;

	// Storage and description
	storageProvider?: FileStorageProvider;
	description?: string;

	// Time slot association
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;

	// Metadata properties
	resolution?: string; // e.g., '1920x1080' or '1080p'
	codec?: string;
	frameRate?: number; // e.g., 30, 60:console.warn();

	// Uploader reference
	uploadedBy?: IEmployee;
	uploadedById?: ID;
}

export interface IVideoUpdate extends Partial<IVideo> {
	id: ID;
}

export type IDeleteVideo = IDeleteEntity;
