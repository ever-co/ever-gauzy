import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { FileStorageProvider } from "./file-provider";
import { ITimeSlot } from "./timesheet.model";
import { IRelationalUser } from "./user.model";

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
    timeSlotId?: ITimeSlot['id'];
}

export interface IScreenshotMap {
    startTime: string;
    endTime: string;
    timeSlots: ITimeSlot[];
}

export interface IUpdateScreenshotInput extends ICreateScreenshotInput {
    id: string;
}

export interface ICreateScreenshotInput extends IBasePerTenantAndOrganizationEntityModel {
    activityTimestamp: string;
    employeeId?: string;
    file: string;
    thumb?: string;
    recordedAt: Date | string;
}
