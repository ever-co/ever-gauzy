import { saveAs } from 'file-saver';
import { downloadFile, downloadFileName, toHttpUrl } from './download-file';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

describe('download-file', () => {
	const BASE = 'https://app.gauzy.test/#/pages/employees/time-off';

	describe('toHttpUrl', () => {
		it('keeps http(s) links, and reads a relative one against the page', () => {
			expect(toHttpUrl('https://files.test/a.pdf', BASE)?.href).toBe('https://files.test/a.pdf');
			expect(toHttpUrl(' http://files.test/a.pdf ', BASE)?.href).toBe('http://files.test/a.pdf');
			expect(toHttpUrl('/public/forms/a.pdf', BASE)?.href).toBe('https://app.gauzy.test/public/forms/a.pdf');
		});

		it.each([
			['javascript:alert(document.cookie)'],
			['JavaScript:alert(1)'],
			['data:text/html,<script>alert(1)</script>'],
			['blob:https://app.gauzy.test/0d8f'],
			['file:///etc/passwd'],
			[''],
			['   '],
			[null],
			[undefined],
			[42]
		])('refuses %p', (url) => {
			expect(toHttpUrl(url, BASE)).toBeNull();
		});
	});

	describe('downloadFileName', () => {
		const url = (href: string) => new URL(href);

		it("names the file after the document, with the link's extension", () => {
			expect(downloadFileName(url('https://files.test/v1/qanadywgn3gxte7kwtwu.pdf'), 'Paid Days off Request')).toBe(
				'Paid Days off Request.pdf'
			);
			expect(downloadFileName(url('https://files.test/forms/request.PDF?v=2'), 'Request.pdf')).toBe('Request.pdf');
			expect(downloadFileName(url('https://files.test/forms/request'), 'Request')).toBe('Request');
		});

		it('drops the characters file systems refuse', () => {
			expect(downloadFileName(url('https://files.test/a.pdf'), 'Paid / Unpaid: "Request"?')).toBe(
				'Paid Unpaid Request.pdf'
			);
		});

		it("falls back to the link's file name, then to `download`", () => {
			expect(downloadFileName(url('https://files.test/forms/Paid%20Leave.pdf'), '  ')).toBe('Paid Leave.pdf');
			expect(downloadFileName(url('https://files.test/'), undefined)).toBe('download');
		});
	});

	describe('downloadFile', () => {
		let fetchMock: jest.Mock;
		let openMock: jest.SpyInstance;
		const originalFetch = globalThis.fetch;

		beforeEach(() => {
			fetchMock = jest.fn();
			globalThis.fetch = fetchMock as unknown as typeof fetch;
			openMock = jest.spyOn(window, 'open').mockImplementation(() => null);
			(saveAs as unknown as jest.Mock).mockClear();
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
			openMock.mockRestore();
		});

		it('fetches the file without cookies or referrer, and saves it under the document name', async () => {
			const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
			fetchMock.mockResolvedValue({ ok: true, blob: async () => blob });

			await expect(downloadFile('https://files.test/v1/abc.pdf', 'Paid Days off Request')).resolves.toBe(
				'downloaded'
			);

			expect(fetchMock).toHaveBeenCalledWith('https://files.test/v1/abc.pdf', {
				credentials: 'omit',
				referrerPolicy: 'no-referrer'
			});
			expect(saveAs).toHaveBeenCalledWith(blob, 'Paid Days off Request.pdf');
			expect(openMock).not.toHaveBeenCalled();
		});

		it('opens the link in a new tab, without access to the page, when the host refuses the fetch', async () => {
			fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

			await expect(downloadFile('https://files.test/v1/abc.pdf', 'Form')).resolves.toBe('opened');

			expect(openMock).toHaveBeenCalledWith('https://files.test/v1/abc.pdf', '_blank', 'noopener,noreferrer');
			expect(saveAs).not.toHaveBeenCalled();
		});

		it('answers `unavailable` when the host has no such file, and opens nothing', async () => {
			fetchMock.mockResolvedValue({ ok: false, status: 404, blob: jest.fn() });

			await expect(downloadFile('https://files.test/gone.pdf', 'Form')).resolves.toBe('unavailable');

			expect(saveAs).not.toHaveBeenCalled();
			expect(openMock).not.toHaveBeenCalled();
		});

		it('neither fetches nor opens a link that is not http(s)', async () => {
			await expect(downloadFile('javascript:alert(1)', 'Form')).resolves.toBe('invalid');
			await expect(downloadFile('', 'Form')).resolves.toBe('invalid');

			expect(fetchMock).not.toHaveBeenCalled();
			expect(openMock).not.toHaveBeenCalled();
		});
	});
});
