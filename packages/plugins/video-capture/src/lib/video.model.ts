import { FileStorageProvider, IBasePerTenantAndOrganizationEntityModel, ITimeSlot, IEmployee, ID, IDeleteEntity } from "@gauzy/contracts";

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
	resolution?: VideoResolutionEnum; // e.g., '1920x1080' or '1080p'
	codec?: VideoCodecEnum;
	frameRate?: number; // e.g., 30, 60

	// Time slot association
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;

	// Uploader reference
	uploadedBy?: IEmployee;
	uploadedById?: ID;
}

/**
 * Represents the data structure for updating a video entity.
 * Includes all properties of `IVideo` as optional, with the `id` being mandatory.
 */
export interface IVideoUpdate extends Partial<IVideo> {
	/**
	 * The unique identifier of the video to be updated.
	 */
	id: ID;
}

/**
 * Represents the structure for deleting a video entity.
 * Inherits properties from `IDeleteEntity` to ensure consistency across delete operations.
 */
export type IDeleteVideo = IDeleteEntity;

/**
 * Enum for standard video resolutions.
 */
export enum VideoResolutionEnum {
    SD = '640:480',             // Standard Definition
    HD = '1280:720',            // High Definition
    FullHD = '1920:1080',       // Full High Definition
    QHD = '2560:1440',          // Quad High Definition
    UHD4K = '3840:2160',        // 4K Ultra High Definition
    UHD5K = '5120:2880',        // 5K Ultra High Definition
    UHD6K = '6144:3160',        // 6K Ultra High Definition
    UHD8K = '7680:4320',        // 8K Ultra High Definition
    DCI4K = '4096:2160',        // Digital Cinema Initiatives 4K
    Cinema2K = '2048:1080',     // Digital Cinema Initiatives 2K
    WXGA = '1366:768',          // Wide Extended Graphics Array
    SXGA = '1280:1024',         // Super Extended Graphics Array
    UXGA = '1600:1200',         // Ultra Extended Graphics Array
    VGA = '640:360',            // Video Graphics Array
    PAL = '720:576',            // PAL Standard Resolution
    NTSC = '720:480'            // NTSC Standard Resolution
}

/**
 * Enum for standard video codecs used for encoding.
 */
export enum VideoCodecEnum {
	libx264 = 'libx264',       // H.264 codec
	libx265 = 'libx265',       // H.265 codec
	libvpx = 'libvpx',         // VP8/VP9 codec
	libaom = 'libaom',         // AV1 codec
	mpeg4 = 'mpeg4',           // MPEG-4 codec
	h263 = 'h263',             // H.263 codec
	h264 = 'h264',             // Generic H.264 codec
	h265 = 'h265',             // Generic H.265 codec
	theora = 'theora',         // Theora codec
	vp8 = 'vp8',               // VP8 codec
	vp9 = 'vp9'                // VP9 codec
}
