import { BadRequestException } from '@nestjs/common';
import { documentStorageOrganizationSegment } from './document-storage-scope';

/**
 * The upload storage engine named the organization folder of a document's key after the raw `Organization-Id`
 * header (follow-up of ever-co/ever-gauzy#11358): any caller could file their bytes under the key prefix of any
 * organization they named. The folder is now the request's own organization, and a malformed header is a 400.
 */
describe('documentStorageOrganizationSegment', () => {
	const TOKEN_ORG = '8b000000-0000-4000-8000-0000000000a1';
	const HEADER_ORG = '8b000000-0000-4000-8000-0000000000b2';
	const FALLBACK = '8b000000-0000-4000-8000-0000000000ff';
	const fallback = () => FALLBACK;

	it("names the request's organization, not the organization the header names", () => {
		expect(documentStorageOrganizationSegment(TOKEN_ORG, HEADER_ORG, fallback)).toBe(TOKEN_ORG);
	});

	it('names the request organization when no header is sent', () => {
		expect(documentStorageOrganizationSegment(TOKEN_ORG, undefined, fallback)).toBe(TOKEN_ORG);
	});

	it('never falls back to the header: a request without an organization gets the fallback segment', () => {
		expect(documentStorageOrganizationSegment(null, HEADER_ORG, fallback)).toBe(FALLBACK);
		expect(documentStorageOrganizationSegment(undefined, undefined, fallback)).toBe(FALLBACK);
	});

	it.each([
		['a non-UUID value', 'not-a-uuid'],
		['a path traversal', '../../other-tenant'],
		['a UUID with a suffix', `${HEADER_ORG}/x`],
		['several values', ['junk', HEADER_ORG]]
	])('refuses %s in the header with a 400, whatever the request organization', (_label, header) => {
		expect(() => documentStorageOrganizationSegment(TOKEN_ORG, header as string | string[], fallback)).toThrow(
			BadRequestException
		);
		expect(() => documentStorageOrganizationSegment(null, header as string | string[], fallback)).toThrow(
			BadRequestException
		);
	});

	it('treats an empty header as no header', () => {
		expect(documentStorageOrganizationSegment(TOKEN_ORG, '', fallback)).toBe(TOKEN_ORG);
	});

	it('keeps the key segment path-safe', () => {
		expect(documentStorageOrganizationSegment('../org/../x', undefined, fallback)).toBe('orgx');
		expect(documentStorageOrganizationSegment('///', undefined, fallback)).toBe(FALLBACK);
	});
});
