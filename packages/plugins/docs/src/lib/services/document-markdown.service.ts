import { ConflictException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { posix } from 'node:path';
import { In, Like } from 'typeorm';
import { BaseEntityEnum, DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { Comment, FileContentTooLargeError } from '@gauzy/core';
import { DOCS_CONTENT_CONFLICT, DOCS_LOCKED, DOCS_MARKDOWN_AMBIGUOUS, DOCS_MARKDOWN_TOO_MANY_PAGES, DOCS_NOT_A_PAGE } from '../docs.constants';
import { UpdateDocumentContentDTO } from '../dto/update-document-content.dto';
import { UpdateDocumentMarkdownDTO } from '../dto/update-document-markdown.dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentService } from './document.service';
import { DocumentUploadService } from './document-upload.service';
import { collectEmployeeMentionIds, collectFileIds, commentAnchorBlockIdOf, docOf, documentToMarkdown, IDocNode, markdownFileNameOf, mergeMarkdownUpdate } from './document-markdown';

/** The most pages one subtree export takes. */
export const DOCS_MARKDOWN_SUBTREE_MAX_PAGES = 500;
/** The most asset bytes one subtree export holds in memory; a file past the budget keeps its API link. */
export const DOCS_MARKDOWN_ASSETS_MAX_BYTES = 256 * 1024 * 1024;

/** One page as Markdown, named for a download. */
export interface IDocumentMarkdownExport {
	fileName: string;
	markdown: string;
}

/** What a Markdown update answered: the document as saved, and what the Markdown changed. */
export interface IDocumentMarkdownUpdateResult {
	document: IDocument;
	/** The document's content revision after the update (unchanged when nothing changed). */
	revision: number;
	changedBlocks: number;
	keptBlocks: number;
	changed: boolean;
}

/** A page, a folder or a file of a subtree export: its place in the zip, and the document. */
export interface ISubtreeEntry {
	document: Document;
	path: string;
	hasChildren: boolean;
	/** A page is a Markdown file, a file is copied as it is, a folder is a folder of the zip (no file of its own). */
	kind: 'page' | 'folder' | 'file';
	/** The entry this one is under (`null` for the root and the root's children). */
	parentId: string | null;
	/** Levels below the root, folders counted (a page under a folder under the root is at 2). */
	depth?: number;
	/** The entry's place in the tree read depth first (parents before their children, siblings in their order). */
	order?: number;
}

/** A subtree as collected: its readable entries, and whether the collection stopped at its limit with nodes left. */
export interface ISubtreeCollection {
	entries: ISubtreeEntry[];
	truncated: boolean;
}

/**
 * The most nodes a subtree walk reads, folders and unreadable nodes included: a tree of folders alone (which the page
 * limit does not count) is bounded too.
 */
const SUBTREE_MAX_NODES = 4 * DOCS_MARKDOWN_SUBTREE_MAX_PAGES;

/** The longest name of a file copied into a zip. */
const ZIP_FILE_NAME_MAX_LENGTH = 120;

/**
 * Markdown in and out of pages (the docs spec, phase 2: FR-12 export, FR-13 update).
 *
 * - **Export** writes a page's canonical JSON as Markdown for the stored subset (`document-markdown.ts`), or a
 *   subtree as a zip: one file per page the caller may read (`index.md` for the root, a folder per page with
 *   children), page links rewritten to relative paths inside the zip, the files a page shows (images and attachments
 *   served by the Documents API) copied under `assets/` and linked relatively.
 * - **Update** applies a Markdown text to a page with the content route's own rules — the revision check, the lock,
 *   the schema, the version snapshot, the HTML cache, the mention and link sync (`DocumentService.updateContent`) —
 *   replacing only the blocks whose Markdown changed: the others keep their stored JSON, attributes and all, also
 *   when the text moved them. An update that would leave a commented block's place to a guess (the block has an
 *   identical twin, and the twins were added, removed or moved) is refused rather than written.
 */
@Injectable()
export class DocumentMarkdownService {
	private readonly logger = new Logger(DocumentMarkdownService.name);
	/** The most asset bytes one subtree export holds in memory (`DOCS_MARKDOWN_ASSETS_MAX_BYTES`; a spec makes it small). */
	private readonly assetsMaxBytes: number = DOCS_MARKDOWN_ASSETS_MAX_BYTES;

	constructor(
		private readonly documents: DocumentService,
		private readonly uploads: DocumentUploadService,
		private readonly repository: TypeOrmDocumentRepository
	) {}

	/** One page as Markdown (the route's 404 when the caller may not read it; 409 when it is not a page). */
	async exportPage(id: ID, organizationId?: ID): Promise<IDocumentMarkdownExport> {
		const document = await this.requirePage(id, organizationId);
		return { fileName: markdownFileNameOf(document.name), markdown: documentToMarkdown(document.contentJson) };
	}

	/**
	 * A page and the pages under it as a zip, written to `output`: the root as `index.md` at the top, every page the
	 * caller may read at `<slug>.md` (or `<slug>/index.md` when it has children of its own) under its parent's folder,
	 * links between the pages relative, the files they show under `assets/`.
	 *
	 * A folder exports the same way, its files included: every file under it the caller may read is copied beside the
	 * pages of its folder (its own name), a page's link to it points there, and the root `index.md` lists what the zip
	 * holds. A file past the export's byte budget is listed with its API link instead.
	 */
	async writeSubtreeZip(root: Document, organizationId: ID | undefined, output: NodeJS.WritableStream): Promise<{ fileName: string; pages: number; files: number }> {
		const isFolder = root.kind === DocumentKindEnum.FOLDER;
		const { entries: tree, truncated } = await this.collectTree(root, organizationId, DOCS_MARKDOWN_SUBTREE_MAX_PAGES, isFolder);
		// A zip that leaves out part of the subtree would read as the whole of it: refused (413) before any byte goes out.
		if (truncated) {
			throw new HttpException(
				{
					statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
					message: `The export takes at most ${DOCS_MARKDOWN_SUBTREE_MAX_PAGES} pages and files; this one holds more`,
					code: DOCS_MARKDOWN_TOO_MANY_PAGES
				},
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		const entries = tree.filter((entry) => entry.kind === 'page');
		// The folder's files first, then the files the pages show: one byte budget for both.
		const attachments = await this.readAttachments(tree.filter((entry) => entry.kind === 'file'), organizationId);
		const pathOf = new Map(entries.map((entry) => [String(entry.document.id), entry.path]));
		const filePathOf = new Map(tree.filter((entry) => attachments.has(String(entry.document.id))).map((entry) => [String(entry.document.id), entry.path]));
		// A link is rewritten to `assets/` only for a file that was read; the others keep the API's URL.
		const assets = await this.readAssets(entries, organizationId, new Set(filePathOf.keys()), totalBytesOf(attachments));
		const archive = new ZipArchive({ zlib: { level: 9 } });
		const done = new Promise<void>((resolve, reject) => {
			archive.on('error', (error: Error) => reject(error));
			archive.on('warning', (error: Error & { code?: string }) => (error.code === 'ENOENT' ? reject(error) : this.logger.warn(`Markdown export: ${error.message}`)));
			output.on('finish', () => resolve());
			output.on('close', () => resolve());
			output.on('error', (error: Error) => reject(error));
		});
		archive.pipe(output);
		for (const entry of entries) {
			const from = posix.dirname(entry.path);
			const markdown = documentToMarkdown(entry.document.contentJson, {
				linkOfDocument: (documentId) => {
					const target = pathOf.get(documentId);
					return target ? posix.relative(from, target) || '.' : `/pages/documents?id=${encodeURIComponent(documentId)}`;
				},
				linkOfFile: (documentId, url) => {
					const inZip = filePathOf.get(documentId);
					// A copied file keeps its own name (spaces, `#`): each segment of the link is encoded.
					if (inZip) return encodePathSegments(posix.relative(from, inZip));
					return assets.has(documentId) ? posix.relative(from, `assets/${assets.get(documentId)!.name}`) : url;
				}
			});
			archive.append(Buffer.from(markdown, 'utf8'), { name: entry.path });
		}
		if (isFolder) {
			archive.append(Buffer.from(folderIndexMarkdown(root, tree, attachments), 'utf8'), { name: 'index.md' });
		}
		// Every folder is an entry of its own, so an empty one is still there once the zip is extracted.
		for (const entry of tree) {
			if (entry.kind === 'folder') archive.append(Buffer.alloc(0), { name: `${entry.path}/` });
		}
		for (const [id, buffer] of attachments) {
			archive.append(buffer, { name: filePathOf.get(id)! });
		}
		for (const asset of assets.values()) {
			archive.append(asset.buffer, { name: `assets/${asset.name}` });
		}
		await Promise.resolve(archive.finalize());
		await done;
		return { fileName: markdownFileNameOf(root.name, 'pages').replace(/\.md$/, '.zip'), pages: entries.length, files: attachments.size };
	}

	/** The root of a subtree export: a page or a folder the caller may read (409 `DOCS_NOT_A_PAGE` for a file). */
	async requireExportRoot(id: ID, organizationId?: ID): Promise<Document> {
		const document = await this.documents.findOneScoped(id, [], organizationId);
		if (document.kind !== DocumentKindEnum.PAGE && document.kind !== DocumentKindEnum.FOLDER) {
			throw new ConflictException({ message: 'A Markdown export is of a page or a folder', code: DOCS_NOT_A_PAGE });
		}
		return document;
	}

	/**
	 * Applies a Markdown text to a page: the blocks whose Markdown changed are the text's, the others stay as stored
	 * (wherever the text moved them); the content route's rules apply (`expectedRevision` → 409 when stale, the lock,
	 * the schema, the snapshot, the HTML cache, the mention and link sync). Nothing is written when the Markdown
	 * changes nothing. A comment is never moved or dropped by a guess: when the merge cannot tell which of identical
	 * blocks a comment is anchored to, the update is refused with 409 `DOCS_MARKDOWN_AMBIGUOUS` (the content
	 * conflict's shape, with the `blockIds` concerned), nothing written.
	 */
	async updateFromMarkdown(id: ID, input: UpdateDocumentMarkdownDTO): Promise<IDocumentMarkdownUpdateResult> {
		const document = await this.requirePage(id, input.organizationId);
		const merge = mergeMarkdownUpdate(document.contentJson, input.markdown);
		const revision = Number(document.contentRevision) || 1;
		if (!merge.changed) {
			// Nothing to write — but the answer is the content route's: no write access is 403, a locked page 423, a
			// stale revision 409, so a client learns the same from an unchanged text as from a changed one.
			await this.assertWritable(document, input, revision);
			return { document, revision, changedBlocks: 0, keptBlocks: merge.keptBlocks, changed: false };
		}
		const ambiguous = await this.commentedAmong(document, merge.ambiguousBlockIds);
		if (ambiguous.length) {
			// Refused like a write: what the write itself would answer (403, 423, a stale revision) comes first.
			await this.assertWritable(document, input, revision);
			throw new ConflictException({
				message: 'The Markdown cannot tell which of identical blocks a comment belongs to (an identical block was added, removed or moved); nothing was written',
				code: DOCS_MARKDOWN_AMBIGUOUS,
				currentRevision: revision,
				blockIds: ambiguous
			});
		}
		const updated = await this.documents.updateContent(id, this.contentInput(document, merge.contentJson, input));
		return { document: updated, revision: Number(updated.contentRevision) || revision + 1, changedBlocks: merge.changedBlocks, keptBlocks: merge.keptBlocks, changed: true };
	}

	/** The content route's answer to a write it would refuse: no write access 403, a locked page 423, a stale revision 409. */
	private async assertWritable(document: Document, input: UpdateDocumentMarkdownDTO, revision: number): Promise<void> {
		await this.documents.assertCanWrite(document);
		if (document.isLocked) {
			throw new HttpException({ message: 'Document is locked', code: DOCS_LOCKED }, HttpStatus.LOCKED);
		}
		if (input.expectedRevision !== undefined && Number(input.expectedRevision) !== revision) {
			throw new ConflictException({ message: 'Document content changed since it was loaded', code: DOCS_CONTENT_CONFLICT, currentRevision: revision });
		}
	}

	/**
	 * The ids among `blockIds` that a comment of the page is anchored to (the `[[block:<blockId>]]` first line the
	 * editor's block threads write). Read only when the merge had to guess.
	 */
	private async commentedAmong(document: Document, blockIds: readonly string[]): Promise<string[]> {
		if (!blockIds.length) return [];
		const comments = await this.repository.manager.find(Comment, {
			select: { id: true, comment: true },
			where: { tenantId: document.tenantId as ID, entity: BaseEntityEnum.Document, entityId: document.id as ID, comment: Like('[[block:%') }
		});
		const anchored = new Set(comments.map((row) => commentAnchorBlockIdOf(row.comment)).filter((blockId): blockId is string => !!blockId));
		return [...new Set(blockIds)].filter((blockId) => anchored.has(blockId));
	}

	private contentInput(document: Document, contentJson: IDocNode, input: UpdateDocumentMarkdownDTO): UpdateDocumentContentDTO {
		return {
			contentJson: contentJson as never,
			expectedUpdatedAt: document.updatedAt as Date,
			...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}),
			...(input.organizationId ? { organizationId: input.organizationId } : {}),
			// The employees the page mentions, as the editor sends them (the platform's mention sync compares the lists).
			mentionEmployeeIds: collectEmployeeMentionIds(contentJson) as ID[]
		} as UpdateDocumentContentDTO;
	}

	/** The page the caller may read (the route's 404), as a page (409 `DOCS_NOT_A_PAGE` otherwise). */
	async requirePage(id: ID, organizationId?: ID): Promise<Document> {
		const document = await this.documents.findOneScoped(id, [], organizationId);
		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({ message: 'Markdown applies to PAGE documents only', code: DOCS_NOT_A_PAGE });
		}
		return document;
	}

	/**
	 * The root and, breadth first, the pages under it that the caller may read: pages become files, folders become
	 * folders of the zip (a folder has no file of its own), and one the caller may not read is left out with its
	 * subtree. The names are unique within their folder. The PDF export reads its subtree here too.
	 */
	async collectSubtree(root: Document, organizationId?: ID): Promise<ISubtreeEntry[]> {
		return (await this.collectSubtreeWithin(root, organizationId)).entries;
	}

	/**
	 * The readable pages of a subtree (at most `limit`, and never more than {@link DOCS_MARKDOWN_SUBTREE_MAX_PAGES}),
	 * each with its depth (folders counted) and its depth-first place; `truncated` when the collection stopped at its
	 * limit with nodes left to read, so a caller with a page limit of its own can refuse rather than export part of it.
	 */
	async collectSubtreeWithin(root: Document, organizationId?: ID, limit = DOCS_MARKDOWN_SUBTREE_MAX_PAGES): Promise<ISubtreeCollection> {
		const { entries, truncated } = await this.collectTree(root, organizationId, limit, false);
		return { entries: entries.filter((entry) => entry.kind === 'page'), truncated };
	}

	/**
	 * The root and, breadth first, what is under it that the caller may read: pages, folders (a folder of the zip, no
	 * file of its own) and, with `withFiles` (a folder's export), files (copied as they are); one the caller may not
	 * read is left out with its subtree. The names are unique within their folder. A folder root has no entry of its
	 * own (the zip's `index.md` lists what it holds). At most `limit` pages and files are collected (folders are not
	 * counted), each with its depth and its depth-first place.
	 */
	private async collectTree(root: Document, organizationId: ID | undefined, limit: number, withFiles: boolean): Promise<ISubtreeCollection> {
		const max = Math.max(1, Math.min(limit, DOCS_MARKDOWN_SUBTREE_MAX_PAGES));
		const isFolder = root.kind === DocumentKindEnum.FOLDER;
		const entries: ISubtreeEntry[] = isFolder ? [] : [{ document: root, path: 'index.md', hasChildren: false, kind: 'page', parentId: null, depth: 0 }];
		/** The pages and files collected: what the limit counts. */
		let counted = entries.length;
		/** Every node read, folders and unreadable ones included ({@link SUBTREE_MAX_NODES}). */
		let visited = 0;
		const entryById = new Map<string, ISubtreeEntry>(entries.map((entry) => [String(entry.document.id), entry]));
		const folderOf = new Map<string, string>([[String(root.id), '']]);
		const depthOf = new Map<string, number>([[String(root.id), 0]]);
		/** Every readable node's readable children (folders too), in their order: the tree the depth-first order reads. */
		const childrenOf = new Map<string, string[]>();
		// The top of the zip has its `index.md` and its `assets/` folder already.
		const taken = new Map<string, Set<string>>([['', new Set(['index', 'index.md', 'assets'])]]);
		const kinds = withFiles ? [DocumentKindEnum.PAGE, DocumentKindEnum.FOLDER, DocumentKindEnum.FILE] : [DocumentKindEnum.PAGE, DocumentKindEnum.FOLDER];
		let frontier: Document[] = [root];
		let truncated = false;
		while (frontier.length && !truncated) {
			const children = await this.repository.find({
				select: { id: true, parentId: true, index: true },
				where: { parentId: In(frontier.map((node) => node.id as ID)), tenantId: root.tenantId as ID, kind: In(kinds) } as never,
				order: { index: 'ASC', createdAt: 'ASC' } as never
			});
			const next: Document[] = [];
			for (const child of children) {
				if (visited >= SUBTREE_MAX_NODES) {
					truncated = true;
					break;
				}
				visited += 1;
				let node: Document;
				try {
					node = await this.documents.findOneScoped(child.id as ID, [], organizationId);
				} catch {
					continue; // not the caller's to read: left out, with what is under it
				}
				// Past the limit, a readable page or file is one too many (an unreadable one, or a folder, is not counted).
				if (counted >= max && node.kind !== DocumentKindEnum.FOLDER) {
					truncated = true;
					break;
				}
				const parentKey = String(child.parentId);
				const parentFolder = folderOf.get(parentKey) ?? '';
				const parent = entryById.get(parentKey);
				if (parent) parent.hasChildren = true;
				const used = taken.get(parentFolder) ?? new Set<string>();
				taken.set(parentFolder, used);
				const parentId = parentKey === String(root.id) ? null : parentKey;
				const depth = (depthOf.get(parentKey) ?? 0) + 1;
				childrenOf.set(parentKey, [...(childrenOf.get(parentKey) ?? []), String(node.id)]);
				if (node.kind === DocumentKindEnum.FILE) {
					// A file has nothing under it: it is copied under its own name.
					entries.push({ document: node, path: posix.join(parentFolder, uniqueFileName(zipFileNameOf(node), used)), hasChildren: false, kind: 'file', parentId, depth });
					entryById.set(String(node.id), entries[entries.length - 1]);
					counted += 1;
					continue;
				}
				const slug = markdownFileNameOf(node.name, String(node.id).slice(0, 8)).replace(/\.md$/, '');
				let name = slug;
				for (let n = 2; used.has(name) || used.has(`${name}.md`); n += 1) name = `${slug}-${n}`;
				used.add(name);
				used.add(`${name}.md`);
				const folder = posix.join(parentFolder, name);
				folderOf.set(String(node.id), folder);
				// A page with children is `<folder>/index.md`: none of its children may take that name in its folder.
				if (node.kind === DocumentKindEnum.PAGE) taken.set(folder, new Set(['index', 'index.md']));
				depthOf.set(String(node.id), depth);
				const kind = node.kind === DocumentKindEnum.PAGE ? 'page' : 'folder';
				entries.push({ document: node, path: posix.join(folder, 'index.md'), hasChildren: false, kind, parentId, depth });
				entryById.set(String(node.id), entries[entries.length - 1]);
				if (kind === 'page') counted += 1;
				next.push(node);
			}
			frontier = next;
		}
		const orderOf = new Map<string, number>();
		const visit = (id: string) => {
			orderOf.set(id, orderOf.size);
			for (const childId of childrenOf.get(id) ?? []) visit(childId);
		};
		visit(String(root.id));
		for (const entry of entries) entry.order = orderOf.get(String(entry.document.id)) ?? orderOf.size;
		for (const entry of entries) {
			const isRootPage = !isFolder && entry === entries[0];
			// A page without children of its own is a file, not a folder with an index; a folder is its folder.
			if (entry.kind === 'page' && !isRootPage && !entry.hasChildren) entry.path = `${posix.dirname(entry.path)}.md`;
			if (entry.kind === 'folder') entry.path = posix.dirname(entry.path);
		}
		return { entries, truncated };
	}

	/**
	 * The bytes of a folder export's files, read with the selected organization, within the export's byte budget
	 * (`DOCS_MARKDOWN_ASSETS_MAX_BYTES`, held in memory until the zip is written); one that cannot be read or does not
	 * fit is left out (the zip's `index.md` lists it with its API link).
	 *
	 * A file's stored size is checked first, so a file known not to fit is never read. Every read is bounded by what is
	 * left of the budget: a file whose size was never stored (or was stored too small) is abandoned at that bound while
	 * it is read, instead of being read whole and only then found too large.
	 */
	private async readAttachments(files: ISubtreeEntry[], organizationId?: ID): Promise<Map<string, Buffer>> {
		const read = new Map<string, Buffer>();
		let totalBytes = 0;
		for (const entry of files) {
			const id = String(entry.document.id);
			const remaining = this.assetsMaxBytes - totalBytes;
			// The stored size first: a file known not to fit is never read into memory. With nothing left, nothing is
			// read at all (a bound of 0 is no bound to the storage read).
			const knownSize = Number(entry.document.fileSize);
			if (remaining <= 0 || (Number.isFinite(knownSize) && knownSize > remaining)) {
				this.warnPastBudget(id);
				continue;
			}
			try {
				const file = await this.uploads.getRawFile(id as ID, organizationId, { maxBytes: remaining });
				// Defence in depth: the bounded read already refuses a file past `remaining` (FileContentTooLargeError).
				if (file.buffer.length > remaining) {
					this.warnPastBudget(id);
					continue;
				}
				totalBytes += file.buffer.length;
				read.set(id, file.buffer);
			} catch (error) {
				this.warnNotAdded(id, error, remaining);
			}
		}
		return read;
	}

	/**
	 * The files the pages show, read with the selected organization; one that cannot be read, or that would take the
	 * export past its asset budget (`DOCS_MARKDOWN_ASSETS_MAX_BYTES`, held in memory until the zip is written), keeps
	 * its API link.
	 */
	private async readAssets(
		entries: ISubtreeEntry[],
		organizationId?: ID,
		inZip: ReadonlySet<string> = new Set(),
		usedBytes = 0
	): Promise<Map<string, { name: string; buffer: Buffer }>> {
		const assets = new Map<string, { name: string; buffer: Buffer }>();
		const ids = new Set<string>();
		for (const entry of entries) {
			for (const id of collectFileIds(docOf(entry.document.contentJson))) {
				// A file the zip already holds (a folder's file) is linked where it is, not copied again.
				if (!inZip.has(id)) ids.add(id);
			}
		}
		let totalBytes = usedBytes;
		for (const id of ids) {
			// Bounded by what is left of the budget, as a folder's files are (the page names only the file's id).
			const remaining = this.assetsMaxBytes - totalBytes;
			if (remaining <= 0) {
				this.warnPastBudget(id);
				continue;
			}
			try {
				const file = await this.uploads.getRawFile(id as ID, organizationId, { maxBytes: remaining });
				// Defence in depth: the bounded read already refuses a file past `remaining` (FileContentTooLargeError).
				if (file.buffer.length > remaining) {
					this.warnPastBudget(id);
					continue;
				}
				totalBytes += file.buffer.length;
				const extension = posix.extname(String(file.fileName ?? '')).toLowerCase().replace(/[^a-z0-9.]/g, '');
				assets.set(id, { name: `${id}${extension}`, buffer: file.buffer });
			} catch (error) {
				this.warnNotAdded(id, error, remaining);
			}
		}
		return assets;
	}

	/** Logs a file left out of an export because it does not fit what is left of the byte budget. */
	private warnPastBudget(id: string): void {
		this.logger.warn(`Markdown export: file ${id} was not added (the export's asset budget of ${this.assetsMaxBytes} bytes is reached)`);
	}

	/**
	 * Logs a file whose read failed. A read refused at what was left of the budget is past the budget, as the stored-size
	 * check says; one refused at a lower bound (the per-file limit) says so in its own words.
	 */
	private warnNotAdded(id: string, error: unknown, remaining: number): void {
		if (error instanceof FileContentTooLargeError && error.maxBytes >= remaining) {
			this.warnPastBudget(id);
			return;
		}
		this.logger.warn(`Markdown export: file ${id} was not added (${(error as Error)?.message ?? error})`);
	}
}

/** A relative path with each segment encoded, as a Markdown link destination takes it (parentheses too). */
function encodePathSegments(path: string): string {
	return path
		.split('/')
		.map((part) => (part === '.' || part === '..' ? part : encodeURIComponent(part).replace(/\(/g, '%28').replace(/\)/g, '%29')))
		.join('/');
}

/** At most `max` UTF-16 units of `text`, never cutting a character in two (a lone surrogate cannot be encoded). */
function cutAtCharacter(text: string, max: number): string {
	let cut = '';
	for (const character of text) {
		if (cut.length + character.length > max) break;
		cut += character;
	}
	return cut;
}

/** The bytes a set of read files holds. */
function totalBytesOf(buffers: ReadonlyMap<string, Buffer>): number {
	let total = 0;
	for (const buffer of buffers.values()) total += buffer.length;
	return total;
}

/** The name a file has in a zip: its uploaded name (else its display name), without what a path or a zip refuses. */
export function zipFileNameOf(document: Pick<Document, 'originalFilename' | 'name' | 'id'>): string {
	const fallback = String(document.id).slice(0, 8);
	const raw = String(document.originalFilename || document.name || fallback);
	// Control characters and the characters a path or a file system refuses become `-`.
	const clean = raw
		// eslint-disable-next-line no-control-regex -- the control characters are what this removes
		.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '-')
		.replace(/^[.\s-]+/, '')
		.trim();
	if (!clean) return fallback;
	if (clean.length <= ZIP_FILE_NAME_MAX_LENGTH) return clean;
	const extension = cutAtCharacter(posix.extname(clean), 16);
	return `${cutAtCharacter(clean, ZIP_FILE_NAME_MAX_LENGTH - extension.length)}${extension}`;
}

/** A name not yet used in its folder (`report.pdf`, then `report-2.pdf`), recorded as used. */
function uniqueFileName(name: string, used: Set<string>): string {
	const extension = posix.extname(name);
	const stem = extension ? name.slice(0, -extension.length) : name;
	let candidate = name;
	for (let n = 2; used.has(candidate.toLowerCase()); n += 1) candidate = `${stem}-${n}${extension}`;
	used.add(candidate.toLowerCase());
	return candidate;
}

/**
 * The `index.md` of a folder's zip: the folder's name and description, then what the zip holds as a nested list of
 * relative links (pages, folders, files); a file that was not copied is linked to the API.
 */
export function folderIndexMarkdown(
	root: Pick<Document, 'name' | 'description'>,
	entries: ReadonlyArray<Pick<ISubtreeEntry, 'document' | 'path' | 'kind' | 'parentId'>>,
	copied: ReadonlyMap<string, unknown>
): string {
	const lines: string[] = [`# ${plainMarkdownText(String(root.name || 'Folder'))}`, ''];
	if (root.description) lines.push(plainMarkdownText(String(root.description)), '');
	const write = (parentId: string | null, depth: number): void => {
		for (const entry of entries.filter((candidate) => candidate.parentId === parentId)) {
			const label = plainMarkdownText(String(entry.document.name || entry.document.originalFilename || entry.path));
			const indent = '  '.repeat(depth);
			if (entry.kind === 'folder') {
				lines.push(`${indent}- ${label}/`);
			} else if (entry.kind === 'file' && !copied.has(String(entry.document.id))) {
				lines.push(`${indent}- [${label}](/api/plugins/docs/documents/${encodeURIComponent(String(entry.document.id))}/raw) (not included)`);
			} else {
				lines.push(`${indent}- [${label}](${encodePathSegments(entry.path)})`);
			}
			write(String(entry.document.id), depth + 1);
		}
	};
	write(null, 0);
	if (!entries.length) lines.push('_This folder is empty._');
	return `${lines.join('\n').trimEnd()}\n`;
}

/** Text that reads as itself in Markdown: no emphasis, link, code or heading by accident, on one line. */
function plainMarkdownText(text: string): string {
	return text.replace(/[\\`*_[\]<>#|]/g, (character) => `\\${character}`).replace(/\s+/g, ' ').trim();
}

/** The document of a stored column value (the pages' JSON may be text on SQLite). */
export { docOf };
