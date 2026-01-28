import { IWasabiRegionServiceURL } from './interfaces';

/**
 * Injection token for Wasabi configuration
 */
export const WASABI_CONFIG = 'WASABI_CONFIG';

/**
 * Injection token for Wasabi configuration provider
 */
export const WASABI_CONFIG_PROVIDER = 'WASABI_CONFIG_PROVIDER';

/**
 * Injection token for Wasabi S3 Provider service
 */
export const WASABI_S3_PROVIDER = 'WASABI_S3_PROVIDER';

/**
 * Default Wasabi region
 */
export const DEFAULT_WASABI_REGION = 'us-east-1';

/**
 * Default Wasabi service URL
 */
export const DEFAULT_WASABI_SERVICE_URL = 'https://s3.wasabisys.com';

/**
 * Array containing mappings between Wasabi regions and their corresponding service URLs.
 */
export const WASABI_REGION_SERVICE_URLS: IWasabiRegionServiceURL[] = [
	{
		region: 'us-east-1',
		serviceUrl: 'https://s3.wasabisys.com'
	},
	{
		region: 'us-east-2',
		serviceUrl: 'https://s3.us-east-2.wasabisys.com'
	},
	{
		region: 'us-central-1',
		serviceUrl: 'https://s3.us-central-1.wasabisys.com'
	},
	{
		region: 'us-west-1',
		serviceUrl: 'https://s3.us-west-1.wasabisys.com'
	},
	{
		region: 'eu-central-1',
		serviceUrl: 'https://s3.eu-central-1.wasabisys.com'
	},
	{
		region: 'eu-west-1',
		serviceUrl: 'https://s3.eu-west-1.wasabisys.com'
	},
	{
		region: 'eu-west-2',
		serviceUrl: 'https://s3.eu-west-2.wasabisys.com'
	},
	{
		region: 'ap-northeast-1',
		serviceUrl: 'https://s3.ap-northeast-1.wasabisys.com'
	},
	{
		region: 'ap-northeast-2',
		serviceUrl: 'https://s3.ap-northeast-2.wasabisys.com'
	},
	{
		region: 'ap-southeast-1',
		serviceUrl: 'https://s3.ap-southeast-1.wasabisys.com'
	},
	{
		region: 'ap-southeast-2',
		serviceUrl: 'https://s3.ap-southeast-2.wasabisys.com'
	}
];

/**
 * Get the service URL for a given Wasabi region.
 *
 * @param region - The Wasabi region
 * @returns The service URL for the region, or the default URL if not found
 */
export function getServiceUrlForRegion(region?: string): string {
	if (!region) {
		return DEFAULT_WASABI_SERVICE_URL;
	}

	const found = WASABI_REGION_SERVICE_URLS.find((item) => item.region === region);
	return found?.serviceUrl ?? DEFAULT_WASABI_SERVICE_URL;
}

/**
 * Get the region for a given Wasabi service URL.
 *
 * @param serviceUrl - The Wasabi service URL
 * @returns The region for the service URL, or the default region if not found
 */
export function getRegionForServiceUrl(serviceUrl?: string): string {
	if (!serviceUrl) {
		return DEFAULT_WASABI_REGION;
	}

	const found = WASABI_REGION_SERVICE_URLS.find((item) => item.serviceUrl === serviceUrl);
	return found?.region ?? DEFAULT_WASABI_REGION;
}

/**
 * Map region and service URL to ensure both are valid and consistent.
 *
 * @param region - Optional Wasabi region
 * @param serviceUrl - Optional Wasabi service URL
 * @returns Object with resolved region and serviceUrl
 */
export function resolveRegionAndServiceUrl(
	region?: string,
	serviceUrl?: string
): { region: string; serviceUrl: string } {
	// If region is provided, find or default the service URL
	if (region) {
		const foundByRegion = WASABI_REGION_SERVICE_URLS.find((item) => item.region === region);
		return {
			region,
			serviceUrl: foundByRegion?.serviceUrl ?? serviceUrl ?? DEFAULT_WASABI_SERVICE_URL
		};
	}

	// If only service URL is provided, find or default the region
	if (serviceUrl) {
		const foundByUrl = WASABI_REGION_SERVICE_URLS.find((item) => item.serviceUrl === serviceUrl);
		return {
			region: foundByUrl?.region ?? DEFAULT_WASABI_REGION,
			serviceUrl
		};
	}

	// Default to us-east-1
	return {
		region: DEFAULT_WASABI_REGION,
		serviceUrl: DEFAULT_WASABI_SERVICE_URL
	};
}
