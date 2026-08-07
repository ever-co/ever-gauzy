import { DocumentReviewReasonEnum, DocumentReviewStatusEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import {
	inferMimeTypeFromKey,
	isEmptyHtml,
	mapArticlePrivacyToVisibility,
	mapDraftToReview,
	mapNodePrivacyToVisibility,
	parseJsonColumn,
	resolveDuplicateName,
	sanitizeLegacyHtml
} from './mapping.utils';

describe('legacy-import mapping utils', () => {
	describe('mapNodePrivacyToVisibility (09 §6.3)', () => {
		it('maps the private eva icon to PRIVATE', () => {
			expect(mapNodePrivacyToVisibility('eye-off-outline')).toBe(DocumentVisibilityEnum.PRIVATE);
		});

		it('maps every other value — including null/undefined — to ORGANIZATION', () => {
			expect(mapNodePrivacyToVisibility('eye-outline')).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility('')).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility(null)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility(undefined)).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});

		it('never maps the exposing direction by accident (unknown strings stay ORGANIZATION)', () => {
			expect(mapNodePrivacyToVisibility('EYE-OFF-OUTLINE')).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});
	});

	describe('mapArticlePrivacyToVisibility (09 §6.4)', () => {
		it('maps privacy: true ("only for employees") to PRIVATE', () => {
			expect(mapArticlePrivacyToVisibility(true)).toBe(DocumentVisibilityEnum.PRIVATE);
		});

		it('maps false / null / undefined to ORGANIZATION', () => {
			expect(mapArticlePrivacyToVisibility(false)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapArticlePrivacyToVisibility(null)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapArticlePrivacyToVisibility(undefined)).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});
	});

	describe('mapDraftToReview (09 §6.4 decision)', () => {
		it('routes drafts into the review queue with reason manual', () => {
			expect(mapDraftToReview(true)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.MANUAL
			});
		});

		it('leaves published articles unflagged', () => {
			expect(mapDraftToReview(false)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.NONE,
				reviewReason: null
			});
			expect(mapDraftToReview(null)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.NONE,
				reviewReason: null
			});
		});
	});

	describe('resolveDuplicateName (09 §7 case 1)', () => {
		it('keeps the original name when no sibling holds it', () => {
			expect(resolveDuplicateName('Handbook', ['Policies'])).toEqual({ name: 'Handbook', suffixed: false });
		});

		it('suffixes deterministically from (2) upwards', () => {
			expect(resolveDuplicateName('Handbook', ['Handbook'])).toEqual({ name: 'Handbook (2)', suffixed: true });
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (2)'])).toEqual({
				name: 'Handbook (3)',
				suffixed: true
			});
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (2)', 'Handbook (3)'])).toEqual({
				name: 'Handbook (4)',
				suffixed: true
			});
		});

		it('compares case-insensitively but preserves the original casing', () => {
			expect(resolveDuplicateName('HandBook', ['handbook'])).toEqual({ name: 'HandBook (2)', suffixed: true });
		});

		it('trims the desired name and falls back to "Untitled" when it is blank', () => {
			expect(resolveDuplicateName('  Handbook  ', [])).toEqual({ name: 'Handbook', suffixed: false });
			expect(resolveDuplicateName('   ', [])).toEqual({ name: 'Untitled', suffixed: false });
		});

		it('fills a gap left in the sequence instead of always appending', () => {
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (3)'])).toEqual({
				name: 'Handbook (2)',
				suffixed: true
			});
		});
	});

	describe('inferMimeTypeFromKey (09 §6.2 — no byte read)', () => {
		it('infers common document and image types from the extension', () => {
			expect(inferMimeTypeFromKey('org/docs/policy.pdf')).toBe('application/pdf');
			expect(inferMimeTypeFromKey('avatar.PNG')).toBe('image/png');
			expect(inferMimeTypeFromKey('sheet.xlsx')).toBe(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			);
		});

		it('ignores query strings and fragments on legacy URLs', () => {
			expect(inferMimeTypeFromKey('https://cdn.example.com/a/policy.pdf?token=abc#page=2')).toBe(
				'application/pdf'
			);
		});

		it('returns null for unknown or missing extensions', () => {
			expect(inferMimeTypeFromKey('no-extension')).toBeNull();
			expect(inferMimeTypeFromKey('archive.weirdext')).toBeNull();
			expect(inferMimeTypeFromKey(null)).toBeNull();
			expect(inferMimeTypeFromKey('')).toBeNull();
		});
	});

	describe('sanitizeLegacyHtml', () => {
		it('drops script/style/iframe blocks and inline handlers', () => {
			const sanitized = sanitizeLegacyHtml(
				'<p onclick="steal()">Hi</p><script>alert(1)</script><iframe src="x"></iframe>'
			);
			expect(sanitized).not.toContain('<script');
			expect(sanitized).not.toContain('<iframe');
			expect(sanitized).not.toContain('onclick');
			expect(sanitized).toContain('Hi');
		});

		it('neutralizes javascript: URLs', () => {
			expect(sanitizeLegacyHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
		});
	});

	describe('isEmptyHtml (09 §7 case 4)', () => {
		it('treats markup-only and entity-only content as empty', () => {
			expect(isEmptyHtml(null)).toBe(true);
			expect(isEmptyHtml('')).toBe(true);
			expect(isEmptyHtml('<p></p>')).toBe(true);
			expect(isEmptyHtml('<p>&nbsp;</p>')).toBe(true);
		});

		it('detects real text', () => {
			expect(isEmptyHtml('<p>Getting started</p>')).toBe(false);
		});
	});

	describe('parseJsonColumn', () => {
		it('passes objects through and parses serialized SQLite text', () => {
			const object = { type: 'doc' };
			expect(parseJsonColumn(object)).toBe(object);
			expect(parseJsonColumn('{"type":"doc"}')).toEqual({ type: 'doc' });
		});

		it('returns null for empty, scalar, or malformed values', () => {
			expect(parseJsonColumn(null)).toBeNull();
			expect(parseJsonColumn('   ')).toBeNull();
			expect(parseJsonColumn('not json')).toBeNull();
			expect(parseJsonColumn('42')).toBeNull();
		});
	});
});
