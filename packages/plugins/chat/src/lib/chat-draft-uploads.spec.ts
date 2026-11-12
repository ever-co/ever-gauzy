import { DocumentKindEnum, DocumentSourceEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import {
	draftUploadTtlHours,
	isChatComposerUpload,
	isDraftSweepEnabled,
	isSafeStoredKey,
	isUntouchedDraft,
	metadataOf,
	storedKeysOf
} from './chat-draft-uploads';

const upload = {
	id: 'd1',
	tenantId: 'ten',
	organizationId: 'org',
	kind: DocumentKindEnum.FILE,
	source: DocumentSourceEnum.CHAT,
	visibility: DocumentVisibilityEnum.PRIVATE,
	parentId: null,
	createdByUserId: 'u1',
	metadata: { upload: { declaredMimeType: 'image/png' } }
};

describe('chat draft uploads', () => {
	it('takes a chat FILE the upload route stored, by a signed-in user, as a composer upload', () => {
		expect(isChatComposerUpload(upload)).toBe(true);
		// SQLite hands the metadata over as JSON text.
		expect(isChatComposerUpload({ ...upload, metadata: JSON.stringify(upload.metadata) })).toBe(true);
	});

	it('leaves out every other document: another source or kind, no uploader, a capture, no upload provenance', () => {
		expect(isChatComposerUpload({ ...upload, source: DocumentSourceEnum.UPLOAD })).toBe(false);
		expect(isChatComposerUpload({ ...upload, kind: DocumentKindEnum.PAGE })).toBe(false);
		expect(isChatComposerUpload({ ...upload, createdByUserId: null })).toBe(false);
		expect(isChatComposerUpload({ ...upload, metadata: { upload: {}, chat: { conversationId: 'c1' } } })).toBe(false);
		expect(isChatComposerUpload({ ...upload, metadata: null })).toBe(false);
		expect(isChatComposerUpload(null)).toBe(false);
	});

	it('purges only an upload its uploader left as it was', () => {
		expect(isUntouchedDraft(upload, 'u1')).toBe(true);
		expect(isUntouchedDraft(upload, 'u2')).toBe(false);
		// Adopted in Docs: moved into a folder, or shared.
		expect(isUntouchedDraft({ ...upload, parentId: 'folder' }, 'u1')).toBe(false);
		expect(isUntouchedDraft({ ...upload, visibility: DocumentVisibilityEnum.ORGANIZATION }, 'u1')).toBe(false);
		// Archived, or in the trash (Docs restores it from there).
		expect(isUntouchedDraft({ ...upload, isArchived: true }, 'u1')).toBe(false);
		expect(isUntouchedDraft({ ...upload, deletedAt: new Date() }, 'u1')).toBe(false);
		expect(isUntouchedDraft({ ...upload, isArchived: false, deletedAt: null }, 'u1')).toBe(true);
	});

	it('frees each stored key once, and only a key a provider may be handed', () => {
		expect(storedKeysOf({ storageKey: 'a/b.png', thumbKey: 'a/b.png' })).toEqual(['a/b.png']);
		expect(storedKeysOf({ storageKey: 'a/b.png', thumbKey: 'a/thumb.webp' })).toEqual(['a/b.png', 'a/thumb.webp']);
		expect(storedKeysOf({ storageKey: '', thumbKey: null })).toEqual([]);
		expect(isSafeStoredKey('docs/ten/b.png')).toBe(true);
		expect(isSafeStoredKey('docs\\ten\\b.png')).toBe(true);
		expect(isSafeStoredKey('../etc/passwd')).toBe(false);
		expect(isSafeStoredKey('/etc/passwd')).toBe(false);
		expect(isSafeStoredKey('C:/x')).toBe(false);
		expect(isSafeStoredKey('a\u0000b')).toBe(false);
	});

	it('reads the TTL and the sweep switch from the environment, with safe defaults', () => {
		expect(draftUploadTtlHours({})).toBe(24);
		expect(draftUploadTtlHours({ GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS: '6' })).toBe(6);
		expect(draftUploadTtlHours({ GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS: '0' })).toBe(24);
		expect(draftUploadTtlHours({ GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS: '1.5' })).toBe(24);
		expect(draftUploadTtlHours({ GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS: 'soon' })).toBe(24);
		expect(isDraftSweepEnabled({})).toBe(true);
		expect(isDraftSweepEnabled({ GAUZY_CHAT_DRAFT_SWEEP_ENABLED: 'false' })).toBe(false);
	});

	it('reads metadata given as an object or as JSON text, and nothing else', () => {
		expect(metadataOf({ a: 1 })).toEqual({ a: 1 });
		expect(metadataOf('{"a":1}')).toEqual({ a: 1 });
		expect(metadataOf('{broken')).toEqual({});
		expect(metadataOf('[1]')).toEqual({});
		expect(metadataOf(['a'])).toEqual({});
		expect(metadataOf(undefined)).toEqual({});
	});
});
