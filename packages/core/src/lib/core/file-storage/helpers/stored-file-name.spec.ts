import { defaultStoredFileName } from './stored-file-name';

/**
 * The storage providers named an upload `<prefix>-<unix seconds>-<0..999>` when its caller named none, and the local
 * provider serves its directory without authentication at `/public/`: an employee's screenshots (and their `thumb-`
 * copies, named after them) could be found by trying a thousand names per second of a work day.
 */
describe('defaultStoredFileName', () => {
	it('keeps the prefix, the upload time and the extension, beside a random UUID', () => {
		const before = Math.floor(Date.now() / 1000);
		const name = defaultStoredFileName('screenshots', 'png');
		const after = Math.floor(Date.now() / 1000);

		const match =
			/^screenshots-(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.png$/.exec(name);
		expect(match).not.toBeNull();
		expect(Number(match?.[1])).toBeGreaterThanOrEqual(before);
		expect(Number(match?.[1])).toBeLessThanOrEqual(after);
	});

	it('names the uploads of the same second differently, beyond a thousand of them', () => {
		const names = new Set(Array.from({ length: 5000 }, () => defaultStoredFileName('screenshots', 'png')));
		expect(names.size).toBe(5000);
	});

	it('appends no extension when given none (Cloudinary public ids)', () => {
		expect(defaultStoredFileName('image-assets')).toMatch(/^image-assets-\d+-[0-9a-f-]{36}$/);
	});
});
