import { withoutEmptyImages } from './capture-images';

/**
 * A display that cannot be captured — a virtual or disconnected screen, one behind the lock screen — comes
 * back from Electron's desktopCapturer as an EMPTY image. The timer uploaded it like any other: the API
 * stored a 0-byte file, failed to make its thumbnail, and answered 201 without a screenshot record
 * (found by the desktop e2e on a workstation with three screens: 3 uploads per capture, 2 records).
 */
describe('withoutEmptyImages', () => {
	const png = (bytes: number) => ({ img: Buffer.alloc(bytes, 1), name: `screen ${bytes}`, id: String(bytes) });

	it('keeps every captured display that has an image', () => {
		expect(withoutEmptyImages([png(10), png(20)]).map((s) => s.id)).toEqual(['10', '20']);
	});

	it('drops a display whose capture is empty, and reports which one', () => {
		const skipped: string[] = [];
		const kept = withoutEmptyImages([png(10), png(0), { img: undefined as unknown as Buffer, name: 'gone', id: 'x' }], (s) =>
			skipped.push(s.name)
		);
		expect(kept.map((s) => s.id)).toEqual(['10']);
		expect(skipped).toEqual(['screen 0', 'gone']);
	});
});
