import {
	assertNotMarkupContent,
	audioUploadFileFilter,
	imageUploadFileFilter,
	isMarkupContent,
	videoUploadFileFilter
} from './upload-security';

type FileFilter = (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void;

/**
 * Runs a multer fileFilter and reports whether the file was accepted.
 */
function runFilter(
	filter: FileFilter,
	mimetype: string,
	originalname: string
): { accepted: boolean; error: Error | null } {
	let accepted = false;
	let error: Error | null = null;
	filter({}, { mimetype, originalname }, (err: Error | null, accept: boolean) => {
		error = err;
		accepted = accept;
	});
	return { accepted, error };
}

/** Minimal valid PNG header. */
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('upload security — file filters', () => {
	describe('imageUploadFileFilter', () => {
		it('accepts a genuine raster image', () => {
			expect(runFilter(imageUploadFileFilter, 'image/png', 'photo.png').accepted).toBe(true);
			expect(runFilter(imageUploadFileFilter, 'image/jpeg', 'photo.jpg').accepted).toBe(true);
			expect(runFilter(imageUploadFileFilter, 'image/webp', 'photo.webp').accepted).toBe(true);
		});

		it('rejects an SVG declared honestly (GHSA-p334-cm7f-php5)', () => {
			const { accepted, error } = runFilter(imageUploadFileFilter, 'image/svg+xml', 'evil.svg');
			expect(accepted).toBe(false);
			expect(error).toBeInstanceOf(Error);
		});

		it('rejects a blocked extension even when the MIME type is spoofed to an allowed one', () => {
			// This is the real attack: the client fully controls both fields, and the extension is what
			// determines the Content-Type the file is later served with.
			for (const name of ['evil.svg', 'evil.svgz', 'evil.html', 'evil.htm', 'evil.xml', 'evil.xhtml']) {
				expect(runFilter(imageUploadFileFilter, 'image/png', name).accepted).toBe(false);
			}
		});

		it('matches blocked extensions case-insensitively', () => {
			expect(runFilter(imageUploadFileFilter, 'image/png', 'EVIL.SVG').accepted).toBe(false);
			expect(runFilter(imageUploadFileFilter, 'image/png', 'Evil.HtMl').accepted).toBe(false);
		});

		it('rejects a disallowed MIME type even with an innocuous extension', () => {
			expect(runFilter(imageUploadFileFilter, 'text/html', 'photo.png').accepted).toBe(false);
			expect(runFilter(imageUploadFileFilter, 'application/octet-stream', 'photo.png').accepted).toBe(false);
		});

		it('rejects a file with no MIME type or name', () => {
			expect(runFilter(imageUploadFileFilter, undefined as any, undefined as any).accepted).toBe(false);
		});
	});

	describe('videoUploadFileFilter', () => {
		it('accepts mp4 and rejects markup masquerading as video', () => {
			expect(runFilter(videoUploadFileFilter, 'video/mp4', 'clip.mp4').accepted).toBe(true);
			expect(runFilter(videoUploadFileFilter, 'video/mp4', 'evil.svg').accepted).toBe(false);
			expect(runFilter(videoUploadFileFilter, 'image/png', 'clip.mp4').accepted).toBe(false);
		});
	});

	describe('audioUploadFileFilter', () => {
		it('accepts audio and rejects markup masquerading as audio', () => {
			expect(runFilter(audioUploadFileFilter, 'audio/mpeg', 'note.mp3').accepted).toBe(true);
			expect(runFilter(audioUploadFileFilter, 'audio/mpeg', 'evil.html').accepted).toBe(false);
			expect(runFilter(audioUploadFileFilter, 'text/html', 'note.mp3').accepted).toBe(false);
		});
	});
});

describe('upload security — content sniffing', () => {
	it('detects a plain SVG payload', () => {
		expect(isMarkupContent(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBe(
			true
		);
	});

	it('detects markup preceded by whitespace', () => {
		expect(isMarkupContent(Buffer.from('\n\r\t   <svg onload="alert(1)"/>'))).toBe(true);
	});

	it('detects markup behind a UTF-8 BOM', () => {
		expect(isMarkupContent(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<svg/>')]))).toBe(true);
	});

	it('detects wide-encoding markup by its BOM (UTF-16/UTF-32 bypass)', () => {
		expect(isMarkupContent(Buffer.from([0xff, 0xfe, 0x3c, 0x00]))).toBe(true); // UTF-16 LE
		expect(isMarkupContent(Buffer.from([0xfe, 0xff, 0x00, 0x3c]))).toBe(true); // UTF-16 BE
		expect(isMarkupContent(Buffer.from([0xff, 0xfe, 0x00, 0x00]))).toBe(true); // UTF-32 LE
		expect(isMarkupContent(Buffer.from([0x00, 0x00, 0xfe, 0xff]))).toBe(true); // UTF-32 BE
	});

	it('detects HTML and XML documents', () => {
		expect(isMarkupContent(Buffer.from('<!DOCTYPE html><html><body></body></html>'))).toBe(true);
		expect(isMarkupContent(Buffer.from('<?xml version="1.0"?><foo/>'))).toBe(true);
	});

	it('does not flag genuine binary media', () => {
		expect(isMarkupContent(PNG_HEADER)).toBe(false);
		expect(isMarkupContent(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false); // JPEG
		expect(isMarkupContent(Buffer.from('GIF89a'))).toBe(false);
		expect(isMarkupContent(Buffer.from('RIFF....WEBP'))).toBe(false);
	});

	it('treats empty or missing content as non-markup', () => {
		expect(isMarkupContent(Buffer.alloc(0))).toBe(false);
		expect(isMarkupContent('')).toBe(false);
		expect(isMarkupContent(null as any)).toBe(false);
	});

	describe('assertNotMarkupContent', () => {
		it('throws on markup', () => {
			expect(() => assertNotMarkupContent(Buffer.from('<svg/>'))).toThrow();
		});

		it('passes genuine media through', () => {
			expect(() => assertNotMarkupContent(PNG_HEADER)).not.toThrow();
		});
	});
});
