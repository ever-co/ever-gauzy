import { environment } from '@gauzy/config';
import { getDummyImage, getOrganizationDummyImage, getTenantLogo, getUserDummyImage } from '../core/utils';
import {
	getPlaceholderImageUrl,
	isDummyImageUrl,
	parsePlaceholderImage,
	replaceDummyImageUrl,
	withoutDummyImageHost
} from './placeholder-image-url';

/**
 * Ever Gauzy #618 (legal audit item 7): placeholder images used to be https://dummyimage.com URLs, so every client that
 * showed a user, organization, team, project, contact or tenant without an image of its own called that third party.
 * They are now short first-party URLs of the API's own placeholder route, and the stored dummyimage.com URLs are
 * replaced by the same placeholder.
 */
describe('placeholder image URLs', () => {
	const base = environment.baseUrl.replace(/\/+$/, '');
	const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	describe('getPlaceholderImageUrl', () => {
		it('is a short URL of the API placeholder route', () => {
			expect(getPlaceholderImageUrl(330, 300, '269aff', 'A', 'https://api.gauzy.co')).toBe(
				'https://api.gauzy.co/api/placeholder/330x300/269aff?text=A'
			);
			expect(getPlaceholderImageUrl(330, 300, '269aff', 'A', 'https://api.gauzy.co/')).toBe(
				'https://api.gauzy.co/api/placeholder/330x300/269aff?text=A'
			);
		});

		it('defaults to the API_BASE_URL', () => {
			expect(getPlaceholderImageUrl(330, 300, '269aff', 'A')).toBe(
				`${base}/api/placeholder/330x300/269aff?text=A`
			);
		});

		it('keeps only letters and digits of the text, at most four, encoded', () => {
			expect(getPlaceholderImageUrl(330, 300, '269aff', 'A&B?#C/D=E', 'http://x')).toBe(
				'http://x/api/placeholder/330x300/269aff?text=ABCD'
			);
			expect(getPlaceholderImageUrl(330, 300, '269aff', 'Élan', 'http://x')).toBe(
				`http://x/api/placeholder/330x300/269aff?text=${encodeURIComponent('Élan')}`
			);
			expect(getPlaceholderImageUrl(330, 300, '269aff', '', 'http://x')).toBe(
				'http://x/api/placeholder/330x300/269aff'
			);
		});

		it('draws an unknown background in the default color, and clamps the size', () => {
			expect(getPlaceholderImageUrl(5000, 0, 'not-a-color', 'A', 'http://x')).toBe(
				'http://x/api/placeholder/1024x1/269aff?text=A'
			);
			expect(getPlaceholderImageUrl(330, 300, 'ABC', 'A', 'http://x')).toBe(
				'http://x/api/placeholder/330x300/aabbcc?text=A'
			);
		});

		it('fits the 255-character logo columns of MySQL, even with four non-Latin letters', () => {
			const url = getPlaceholderImageUrl(
				330,
				300,
				'269aff',
				'漢字仮名',
				'https://api.some-long-tenant-domain.example.com'
			);
			expect(url.length).toBeLessThan(255);
		});
	});

	describe('getDummyImage and its callers', () => {
		it('write no dummyimage.com URL', () => {
			const urls = [
				getDummyImage(330, 300, 'A'),
				getUserDummyImage({ firstName: 'ada', email: 'ada@example.com' } as any),
				getUserDummyImage({ email: 'bob@example.com' } as any),
				getOrganizationDummyImage('Ever'),
				getTenantLogo('Tenant')
			];
			for (const url of urls) {
				expect(url).not.toMatch(/dummyimage/);
				expect(url).toMatch(
					new RegExp(`^${escapedBase}/api/placeholder/330x300/(269aff|ffaf26|8b72ff|0ecc9d)\\?text=[ABET]$`)
				);
			}
		});
	});

	describe('parsePlaceholderImage', () => {
		it('reads the size, the background and the text', () => {
			expect(parsePlaceholderImage('330x300', '269AFF', 'AB')).toEqual({
				width: 330,
				height: 300,
				background: '269aff',
				text: 'AB'
			});
			expect(parsePlaceholderImage('1x1024', 'abc', undefined)).toEqual({
				width: 1,
				height: 1024,
				background: 'aabbcc',
				text: ''
			});
		});

		it('takes the first of a repeated text, and only its letters and digits', () => {
			expect(parsePlaceholderImage('330x300', '269aff', ['A<b>', 'C'])?.text).toBe('Ab');
		});

		it('refuses a size or a background it cannot draw', () => {
			for (const [size, background] of [
				['0x300', '269aff'],
				['330x0', '269aff'],
				['1025x300', '269aff'],
				['330x99999', '269aff'],
				['330', '269aff'],
				['330x300x1', '269aff'],
				['-1x300', '269aff'],
				['330x300', '269af'],
				['330x300', 'zzzzzz'],
				['330x300', '#269aff'],
				['330x300', '269aff.png']
			]) {
				expect(parsePlaceholderImage(size, background, 'A')).toBeUndefined();
			}
		});
	});

	describe('withoutDummyImageHost', () => {
		it('replaces a stored dummyimage.com placeholder by the first-party one', () => {
			expect(withoutDummyImageHost('https://dummyimage.com/330x300/269aff/ffffff.jpg&text=A')).toBe(
				`${base}/api/placeholder/330x300/269aff?text=A`
			);
			expect(withoutDummyImageHost('  http://www.dummyimage.com/330x300/8B72FF/fff.png?text=AB  ')).toBe(
				`${base}/api/placeholder/330x300/8b72ff?text=AB`
			);
			expect(withoutDummyImageHost('//dummyimage.com/600/0ecc9d')).toBe(`${base}/api/placeholder/600x600/0ecc9d`);
		});

		it('replaces the former Angular default, which had no text', () => {
			expect(withoutDummyImageHost('https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text')).toBe(
				`${base}/api/placeholder/330x300/8b72ff`
			);
		});

		it('decodes the text, and keeps what it can of a malformed one', () => {
			expect(withoutDummyImageHost('https://dummyimage.com/330x300/269aff/ffffff.jpg&text=%C3%89')).toBe(
				`${base}/api/placeholder/330x300/269aff?text=${encodeURIComponent('É')}`
			);
			expect(withoutDummyImageHost('https://dummyimage.com/330x300/269aff/ffffff.jpg&text=A+B')).toBe(
				`${base}/api/placeholder/330x300/269aff?text=AB`
			);
			expect(withoutDummyImageHost('https://dummyimage.com/330x300/269aff/ffffff.jpg&text=Z%E0%A4%A')).toBe(
				`${base}/api/placeholder/330x300/269aff?text=ZE0A`
			);
		});

		it('still gives a first-party placeholder for a dummyimage.com URL it cannot read', () => {
			expect(withoutDummyImageHost('https://dummyimage.com/')).toBe(`${base}/api/placeholder/330x300/269aff`);
			expect(withoutDummyImageHost('https://dummyimage.com')).toBe(`${base}/api/placeholder/330x300/269aff`);
			expect(withoutDummyImageHost('https://dummyimage.com/99999x99999/notacolor/x.gif')).toBe(
				`${base}/api/placeholder/1024x1024/269aff`
			);
		});

		it('leaves every other value as it is', () => {
			for (const value of [
				undefined,
				null,
				'',
				42,
				'https://api.gauzy.co/public/avatars/ada.png',
				`${base}/api/placeholder/330x300/269aff?text=A`,
				'https://dummyimage.com.evil.example/330x300/269aff&text=A',
				'https://cdn.example.com/?u=https://dummyimage.com/330x300',
				'data:image/png;base64,AAAA'
			]) {
				expect(withoutDummyImageHost(value)).toBe(value);
				expect(isDummyImageUrl(value)).toBe(false);
			}
		});
	});

	describe('replaceDummyImageUrl', () => {
		it('replaces a dummyimage.com URL in the field', () => {
			const team = { name: 'Alpha', logo: 'https://dummyimage.com/330x300/ffaf26/ffffff.jpg&text=A' };
			replaceDummyImageUrl(team, 'logo');
			expect(team.logo).toBe(`${base}/api/placeholder/330x300/ffaf26?text=A`);
		});

		it('leaves another URL, and a partial entity without the field, untouched', () => {
			const user = { imageUrl: 'https://cdn.example.com/a.png' };
			replaceDummyImageUrl(user, 'imageUrl');
			expect(user).toEqual({ imageUrl: 'https://cdn.example.com/a.png' });

			const partial: { name: string; imageUrl?: string } = { name: 'Renamed' };
			replaceDummyImageUrl(partial, 'imageUrl');
			expect(Object.keys(partial)).toEqual(['name']);

			expect(() => replaceDummyImageUrl(undefined as unknown as { logo?: string }, 'logo')).not.toThrow();
		});
	});
});
