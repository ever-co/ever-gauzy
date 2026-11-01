export const API_PREFIX = '/api';
export const DEFAULT_SVG = 'assets/images/default.svg';
export const AVATAR_DEFAULT_SVG = 'assets/images/avatars/avatar-default.svg';
/**
 * The placeholder image the API draws, root-relative: it resolves only where the API shares the app's origin.
 *
 * @deprecated Use `getPlaceholderProfileImageUrl(environment.API_BASE_URL)`. This used to be a dummyimage.com URL,
 * which made every browser showing it call that third party (legal audit item 7).
 */
export const DUMMY_PROFILE_IMAGE = `${API_PREFIX}/placeholder/330x300/8b72ff`;
export const BACKGROUND_SYNC_INTERVAL = 25000; // milliseconds
