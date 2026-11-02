import { DUMMY_PROFILE_IMAGE } from '../constants/app.constants';
import { getPlaceholderProfileImageUrl } from './placeholder-image';

describe('getPlaceholderProfileImageUrl', () => {
	it('points at the API placeholder route, not dummyimage.com', () => {
		expect(getPlaceholderProfileImageUrl('https://api.gauzy.co')).toBe(
			'https://api.gauzy.co/api/placeholder/330x300/8b72ff'
		);
		expect(DUMMY_PROFILE_IMAGE).toBe(getPlaceholderProfileImageUrl(''));
	});

	it('drops a trailing slash of the base URL', () => {
		expect(getPlaceholderProfileImageUrl('http://localhost:3000/')).toBe(
			'http://localhost:3000/api/placeholder/330x300/8b72ff'
		);
	});

	it('is root-relative when the API is served from the same origin', () => {
		expect(getPlaceholderProfileImageUrl(undefined)).toBe('/api/placeholder/330x300/8b72ff');
		expect(getPlaceholderProfileImageUrl(null)).toBe('/api/placeholder/330x300/8b72ff');
	});
});
