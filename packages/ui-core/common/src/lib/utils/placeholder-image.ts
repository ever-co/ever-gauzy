import { API_PREFIX } from '../constants/app.constants';

/**
 * The URL of the placeholder image a record gets when its own image is removed: a plain colored square the API draws
 * (`GET /api/placeholder/:size/:background`).
 *
 * It replaces `DUMMY_PROFILE_IMAGE`, a dummyimage.com URL: showing it made every browser call that third party, which
 * has no legal entity, privacy policy or contract (legal audit item 7).
 *
 * @param apiBaseUrl The API's URL (`environment.API_BASE_URL`); empty when the API is served from the app's own origin.
 * @returns The placeholder's URL.
 */
export function getPlaceholderProfileImageUrl(apiBaseUrl: string | null | undefined): string {
	return `${(apiBaseUrl ?? '').replace(/\/+$/, '')}${API_PREFIX}/placeholder/330x300/8b72ff`;
}
