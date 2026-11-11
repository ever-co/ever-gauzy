/**
 * Importing the file storage reaches `core/entities/internal` and the decorator graph. Loading that graph FIRST
 * matches the application boot order (see employee.entity.spec.ts).
 */
import '../entities/internal';

import { localFileUrl } from './file-storage';

/**
 * ever-co/ever-teams#5024: Ever Teams stores an icon of its library as `hugeicons:<key>` in the `icon` column of a
 * status, priority, size or issue type. The load hooks build `fullIconUrl` with `localFileUrl`, which turned that
 * value into `<API>/public/hugeicons:done`: a URL to a file that does not exist, shown as a broken image by the
 * clients that display `fullIconUrl`.
 */
describe('localFileUrl', () => {
	it('serves a relative icon path from the public folder', async () => {
		const url = await localFileUrl('ever-icons/task-statuses/open.svg');

		expect(new URL(url as string).pathname).toBe('/public/ever-icons/task-statuses/open.svg');
	});

	it('keeps a URL as it is', async () => {
		await expect(localFileUrl('https://cdn.example.com/icons/rocket.png')).resolves.toBe(
			'https://cdn.example.com/icons/rocket.png'
		);
		const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
		await expect(localFileUrl(dataUrl)).resolves.toBe(dataUrl);
	});

	it('gives no URL for an icon of the Ever Teams library, which is no file', async () => {
		await expect(localFileUrl('hugeicons:done')).resolves.toBeNull();
		await expect(localFileUrl('hugeicons:in-progress')).resolves.toBeNull();
	});
});
