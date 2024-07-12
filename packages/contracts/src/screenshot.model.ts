import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { FileStorageProvider } from './file-provider';
import { ITimeSlot } from './timesheet.model';
import { IRelationalUser } from './user.model';

export interface IScreenshot extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	[x: string]: any;
	file: string;
	thumb?: string;
	fileUrl?: string;
	thumbUrl?: string;
	fullUrl?: string;
	recordedAt?: Date;
	storageProvider?: FileStorageProvider;
	/** Image/Screenshot Analysis Through Gauzy AI */
	isWorkRelated?: boolean;
	description?: string;
	apps?: string | string[];
	/** Relations */
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;
}

export interface IScreenshotMap {
	startTime: string;
	endTime: string;
	timeSlots: ITimeSlot[];
}

export interface IScreenshotUpdateInput extends IScreenshotCreateInput {}

export interface IScreenshotCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	activityTimestamp: string;
	file: string;
	thumb?: string;
	recordedAt: Date | string;
}
