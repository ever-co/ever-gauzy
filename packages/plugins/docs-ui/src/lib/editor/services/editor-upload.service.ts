import { Injectable, NgZone, inject } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TranslateService } from '@ngx-translate/core';
import { DocumentSourceEnum, ID, IDocument } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { DocumentsService } from '../../services/documents.service';
import {
	DOCS_DEFAULT_MAX_FILE_SIZE_BYTES,
	DOCS_UPLOAD_ACCEPT
} from '../../docs.constants';

export type EditorUploadStatus = 'uploading' | 'error';

export interface IEditorUpload {
	uploadId: string;
	file: File;
	kind: 'image' | 'file';
	status: EditorUploadStatus;
	progress: number;
	objectUrl?: string;
	error?: string;
}

const ALLOWED_EXTENSIONS = new Set(
	DOCS_UPLOAD_ACCEPT.split(',').map((extension) => extension.trim().toLowerCase())
);

/**
 * Editor image/file upload pipeline (spec 05 §6.6):
 * intercept → validate → placeholder insert (blob preview / attachment card
 * with transient `uploadId`) → `POST /documents/upload` (`source: EDITOR`,
 * `parentId` = the page id) → one-transaction placeholder→final swap.
 * Base64 never enters the doc; autosave skips while `hasPending`.
 */
@Injectable()
export class EditorUploadService {
	private readonly documentsService = inject(DocumentsService);
	private readonly toastrService = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly zone = inject(NgZone);

	private readonly uploads = new Map<string, IEditorUpload>();
	private readonly _pendingCount$ = new BehaviorSubject<number>(0);
	/** Number of in-flight or failed placeholders still in the doc. */
	public readonly pendingCount$ = this._pendingCount$.asObservable();

	/** The PAGE document uploads attach under (child FILE documents). */
	public parentDocumentId: ID | null = null;
	/** Org max file size — refreshed from settings by the page component. */
	public maxFileSizeBytes = DOCS_DEFAULT_MAX_FILE_SIZE_BYTES;

	get hasPending(): boolean {
		return this._pendingCount$.value > 0;
	}

	getUpload(uploadId: string | null | undefined): IEditorUpload | undefined {
		return uploadId ? this.uploads.get(uploadId) : undefined;
	}

	/** FileHandler onDrop/onPaste + slash/file-picker entry point. */
	handleFiles(editor: Editor, files: File[] | FileList, pos?: number): void {
		for (const file of Array.from(files)) {
			if (!this.validate(file)) continue;
			this.startUpload(editor, file, pos);
			pos = undefined; // subsequent files insert at the selection
		}
	}

	retry(editor: Editor, uploadId: string): void {
		const upload = this.uploads.get(uploadId);
		if (!upload || upload.status !== 'error') return;
		upload.status = 'uploading';
		upload.progress = 0;
		this.emitPending();
		this.performUpload(editor, upload);
	}

	remove(editor: Editor, uploadId: string): void {
		const upload = this.uploads.get(uploadId);
		if (upload?.objectUrl) URL.revokeObjectURL(upload.objectUrl);
		this.uploads.delete(uploadId);
		this.emitPending();
		// Drop the placeholder node from the doc.
		const position = this.findByUploadId(editor, uploadId);
		if (position) {
			editor.view.dispatch(editor.view.state.tr.delete(position.pos, position.pos + position.node.nodeSize));
		}
	}

	destroy(): void {
		this.uploads.forEach((upload) => {
			if (upload.objectUrl) URL.revokeObjectURL(upload.objectUrl);
		});
		this.uploads.clear();
		this._pendingCount$.next(0);
	}

	// ─── Internals ───────────────────────────────────────────────

	private validate(file: File): boolean {
		if (file.size > this.maxFileSizeBytes) {
			this.toastrService.danger(
				this.translate.instant('DOCS.UPLOAD.FILE_TOO_LARGE', {
					name: file.name,
					max: `${Math.round(this.maxFileSizeBytes / (1024 * 1024))} MB`
				})
			);
			return false;
		}
		const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
		if (!ALLOWED_EXTENSIONS.has(extension)) {
			this.toastrService.danger(this.translate.instant('DOCS.UPLOAD.TYPE_NOT_ALLOWED', { name: file.name }));
			return false;
		}
		return true;
	}

	private startUpload(editor: Editor, file: File, pos?: number): void {
		const uploadId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		const isImage = file.type.startsWith('image/');
		const upload: IEditorUpload = {
			uploadId,
			file,
			kind: isImage ? 'image' : 'file',
			status: 'uploading',
			progress: 0,
			objectUrl: isImage ? URL.createObjectURL(file) : undefined
		};
		this.uploads.set(uploadId, upload);
		this.emitPending();

		const content = isImage
			? { type: 'image', attrs: { src: upload.objectUrl, alt: file.name, uploadId } }
			: {
					type: 'fileAttachment',
					attrs: { documentId: null, name: file.name, size: file.size, mimeType: file.type, uploadId }
			  };

		const chain = editor.chain().focus();
		if (typeof pos === 'number') chain.insertContentAt(pos, content);
		else chain.insertContent(content);
		chain.run();

		this.performUpload(editor, upload);
	}

	private performUpload(editor: Editor, upload: IEditorUpload): void {
		this.documentsService
			.upload(upload.file, {
				parentId: this.parentDocumentId ?? undefined,
				source: DocumentSourceEnum.EDITOR,
				importToKnowledge: false
			})
			.subscribe({
				next: (event) => {
					if (event.type === HttpEventType.UploadProgress && event.total) {
						upload.progress = Math.round((event.loaded / event.total) * 100);
					} else if (event.type === HttpEventType.Response && event.body) {
						this.zone.run(() => this.swap(editor, upload, event.body as IDocument));
					}
				},
				error: (error) => {
					this.zone.run(() => {
						upload.status = 'error';
						upload.error = error?.error?.message ?? 'upload failed';
						this.emitPending();
						// Nudge node views to re-render their error state.
						editor.view.dispatch(editor.view.state.tr.setMeta('gzUploadStateChanged', upload.uploadId));
					});
				}
			});
	}

	/** One transaction swaps placeholder attrs to the final child-FILE document (spec 05 §6.6 step 5). */
	private swap(editor: Editor, upload: IEditorUpload, document: IDocument): void {
		const position = this.findByUploadId(editor, upload.uploadId);
		if (position) {
			const attrs =
				upload.kind === 'image'
					? {
							...position.node.attrs,
							uploadId: null,
							documentId: String(document.id),
							src: this.documentsService.rawUrl(document.id)
					  }
					: {
							...position.node.attrs,
							uploadId: null,
							documentId: String(document.id),
							name: document.name ?? upload.file.name,
							size: document.fileSize ?? upload.file.size,
							mimeType: document.mimeType ?? upload.file.type
					  };
			editor.view.dispatch(editor.view.state.tr.setNodeMarkup(position.pos, undefined, attrs));
		}
		if (upload.objectUrl) URL.revokeObjectURL(upload.objectUrl);
		this.uploads.delete(upload.uploadId);
		this.emitPending();
	}

	private findByUploadId(editor: Editor, uploadId: string): { node: ProseMirrorNode; pos: number } | null {
		let found: { node: ProseMirrorNode; pos: number } | null = null;
		editor.state.doc.descendants((node, pos) => {
			if (found) return false;
			if (node.attrs?.['uploadId'] === uploadId) {
				found = { node, pos };
				return false;
			}
			return true;
		});
		return found;
	}

	private emitPending(): void {
		this._pendingCount$.next(this.uploads.size);
	}
}

/**
 * Persist-safe deep copy of the doc JSON (spec 05 §6.6): drops transient
 * `uploadId` attrs, removes `image` nodes whose `src` is still a blob/data URL
 * and `fileAttachment` placeholders without a `documentId`.
 */
export function sanitizeContentJson(json: unknown): unknown {
	const clean = (node: unknown): unknown | null => {
		if (!node || typeof node !== 'object') return node;
		const typed = node as {
			type?: string;
			attrs?: Record<string, unknown>;
			content?: unknown[];
			[key: string]: unknown;
		};
		if (typed.type === 'image') {
			const src = typed.attrs?.['src'];
			if (typeof src === 'string' && (src.startsWith('blob:') || src.startsWith('data:'))) return null;
		}
		if (typed.type === 'fileAttachment' && !typed.attrs?.['documentId']) return null;
		const copy: Record<string, unknown> = { ...typed };
		if (typed.attrs && 'uploadId' in typed.attrs) {
			const { uploadId: _uploadId, ...rest } = typed.attrs;
			copy['attrs'] = rest;
		}
		if (Array.isArray(typed.content)) {
			copy['content'] = typed.content.map(clean).filter((child) => child !== null);
		}
		return copy;
	};
	return clean(json);
}
