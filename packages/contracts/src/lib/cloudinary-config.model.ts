export interface ICloudinaryConfig {
	cloudinary_cloud_name?: string;
	cloudinary_api_key?: string;
	cloudinary_api_secret?: string;
	cloudinary_cdn_url?: string;
}

export const CLOUDINARY_CONFIG_KEYS = [
	'cloudinary_cloud_name',
	'cloudinary_api_key',
	'cloudinary_api_secret',
	'cloudinary_cdn_url'
] as const;
