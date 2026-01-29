/**
 * Injection token for S3 configuration
 */
export const S3_CONFIG = 'S3_CONFIG';

/**
 * Injection token for S3 configuration provider
 */
export const S3_CONFIG_PROVIDER = 'S3_CONFIG_PROVIDER';

/**
 * Injection token for S3 Provider service
 */
export const S3_PROVIDER = 'S3_PROVIDER';

/**
 * Default S3 region
 */
export const DEFAULT_S3_REGION = 'us-east-1';

/**
 * Common AWS S3 regions with their endpoints.
 * Note: Standard AWS S3 uses region-based endpoints automatically,
 * but this mapping is useful for S3-compatible services.
 */
export const S3_REGION_ENDPOINTS: Record<string, string> = {
	'us-east-1': 'https://s3.us-east-1.amazonaws.com',
	'us-east-2': 'https://s3.us-east-2.amazonaws.com',
	'us-west-1': 'https://s3.us-west-1.amazonaws.com',
	'us-west-2': 'https://s3.us-west-2.amazonaws.com',
	'eu-west-1': 'https://s3.eu-west-1.amazonaws.com',
	'eu-west-2': 'https://s3.eu-west-2.amazonaws.com',
	'eu-west-3': 'https://s3.eu-west-3.amazonaws.com',
	'eu-central-1': 'https://s3.eu-central-1.amazonaws.com',
	'eu-north-1': 'https://s3.eu-north-1.amazonaws.com',
	'ap-northeast-1': 'https://s3.ap-northeast-1.amazonaws.com',
	'ap-northeast-2': 'https://s3.ap-northeast-2.amazonaws.com',
	'ap-northeast-3': 'https://s3.ap-northeast-3.amazonaws.com',
	'ap-southeast-1': 'https://s3.ap-southeast-1.amazonaws.com',
	'ap-southeast-2': 'https://s3.ap-southeast-2.amazonaws.com',
	'ap-south-1': 'https://s3.ap-south-1.amazonaws.com',
	'sa-east-1': 'https://s3.sa-east-1.amazonaws.com',
	'ca-central-1': 'https://s3.ca-central-1.amazonaws.com',
	'me-south-1': 'https://s3.me-south-1.amazonaws.com',
	'af-south-1': 'https://s3.af-south-1.amazonaws.com'
};

/**
 * Get the S3 endpoint URL for a given region.
 *
 * @param region - The AWS region
 * @returns The endpoint URL for the region, or null if using default AWS endpoints
 */
export function getEndpointForRegion(region?: string): string | null {
	if (!region) {
		return null;
	}

	return S3_REGION_ENDPOINTS[region] ?? null;
}

/**
 * Validate if a string is a valid AWS region.
 *
 * @param region - The region string to validate
 * @returns True if the region is valid
 */
export function isValidS3Region(region: string): boolean {
	return region in S3_REGION_ENDPOINTS;
}

/**
 * Get all available S3 regions.
 *
 * @returns Array of valid region strings
 */
export function getAvailableS3Regions(): string[] {
	return Object.keys(S3_REGION_ENDPOINTS);
}
