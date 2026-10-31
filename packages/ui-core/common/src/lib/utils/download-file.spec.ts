import { saveAs } from 'file-saver';
import { downloadFile, downloadFileName } from './download-file';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

describe('download-file', () => {
	describe('downloadFileName', () => {
		const url = (href: string) => new URL(href);

		it("names the file after the document, with the link's extension", () => {
			expect(
				downloadFileName(url('https://files.test/v1/qanadywgn3gxte7kwtwu.pdf'), 'Paid Days off Request')
			).toBe('Paid Days off Request.pdf');
			expect(downloadFileName(url('https://files.test/forms/request.PDF?v=2'), 'Request.pdf')).toBe(
				'Request.pdf'
			);
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
			openMock = jest.spyOn(window, 'open');
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
			const tab = { opener: window, location: { href: 'about:blank' } };
			openMock.mockImplementation(() => tab as unknown as Window);
			fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

			await expect(downloadFile('https://files.test/v1/abc.pdf', 'Form')).resolves.toBe('opened');

			expect(tab).toEqual({ opener: null, location: { href: 'https://files.test/v1/abc.pdf' } });
			expect(saveAs).not.toHaveBeenCalled();
		});

		it('answers `blocked` when the browser blocks that tab, so the caller can offer a link', async () => {
			openMock.mockImplementation(() => null);
			fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

			await expect(downloadFile('https://files.test/v1/abc.pdf', 'Form')).resolves.toBe('blocked');

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
