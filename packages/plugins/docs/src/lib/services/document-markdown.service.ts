import { ConflictException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { posix } from 'node:path';
import { In } from 'typeorm';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { DOCS_CONTENT_CONFLICT, DOCS_LOCKED, DOCS_NOT_A_PAGE } from '../docs.constants';
import { UpdateDocumentContentDTO } from '../dto/update-document-content.dto';
import { UpdateDocumentMarkdownDTO } from '../dto/update-document-markdown.dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentService } from './document.service';
import { DocumentUploadService } from './document-upload.service';
import { collectEmployeeMentionIds, collectFileIds, docOf, documentToMarkdown, IDocNode, markdownFileNameOf, mergeMarkdownUpdate } from './document-markdown';

/** The most pages one subtree export takes. */
export const DOCS_MARKDOWN_SUBTREE_MAX_PAGES = 500;

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

/** A page of a subtree export: its place in the zip, and the page. */
interface ISubtreeEntry {
	document: Document;
	path: string;
	hasChildren: boolean;
}

/**
 * Markdown in and out of pages (the docs spec, phase 2: FR-12 export, FR-13 update).
 *
 * - **Export** writes a page's canonical JSON as Markdown for the stored subset (`document-markdown.ts`), or a
 *   subtree as a zip: one file per page the caller may read (`index.md` for the root, a folder per page with
 *   children), page links rewritten to relative paths inside the zip, the files a page shows (images and attachments
 *   served by the Documents API) copied under `assets/` and linked relatively.
 * - **Update** applies a Markdown text to a page with the content route's own rules — the revision check, the lock,
 *   the schema, the version snapshot, the HTML cache, the mention and link sync (`DocumentService.updateContent`) —
 *   replacing only the blocks whose Markdown changed: the others keep their stored JSON, attributes and all.
 */
@Injectable()
export class DocumentMarkdownService {
	private readonly logger = new Logger(DocumentMarkdownService.name);

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
	 */
	async writeSubtreeZip(id: ID, organizationId: ID | undefined, output: NodeJS.WritableStream): Promise<{ fileName: string; pages: number }> {
		const root = await this.requirePage(id, organizationId);
		const entries = await this.collectSubtree(root, organizationId);
		const pathOf = new Map(entries.map((entry) => [String(entry.document.id), entry.path]));
		// The files first: a link is rewritten to `assets/` only for a file that was read; the others keep the API's URL.
		const assets = await this.readAssets(entries, organizationId);
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
				linkOfFile: (documentId, url) => (assets.has(documentId) ? posix.relative(from, `assets/${assets.get(documentId)!.name}`) : url)
			});
			archive.append(Buffer.from(markdown, 'utf8'), { name: entry.path });
		}
		for (const asset of assets.values()) {
			archive.append(asset.buffer, { name: `assets/${asset.name}` });
		}
		await Promise.resolve(archive.finalize());
		await done;
		return { fileName: markdownFileNameOf(root.name, 'pages').replace(/\.md$/, '.zip'), pages: entries.length };
	}

	/**
	 * Applies a Markdown text to a page: the blocks whose Markdown changed are the text's, the others stay as stored;
	 * the content route's rules apply (`expectedRevision` → 409 when stale, the lock, the schema, the snapshot, the
	 * HTML cache, the mention and link sync). Nothing is written when the Markdown changes nothing.
	 */
	async updateFromMarkdown(id: ID, input: UpdateDocumentMarkdownDTO): Promise<IDocumentMarkdownUpdateResult> {
		const document = await this.requirePage(id, input.organizationId);
		const merge = mergeMarkdownUpdate(document.contentJson, input.markdown);
		const revision = Number(document.contentRevision) || 1;
		if (!merge.changed) {
			// Nothing to write — but the answer is the content route's: no write access is 403, a locked page 423, a
			// stale revision 409, so a client learns the same from an unchanged text as from a changed one.
			await this.documents.assertCanWrite(document);
			if (document.isLocked) {
				throw new HttpException({ message: 'Document is locked', code: DOCS_LOCKED }, HttpStatus.LOCKED);
			}
			if (input.expectedRevision !== undefined && Number(input.expectedRevision) !== revision) {
				throw new ConflictException({ message: 'Document content changed since it was loaded', code: DOCS_CONTENT_CONFLICT, currentRevision: revision });
			}
			return { document, revision, changedBlocks: 0, keptBlocks: merge.keptBlocks, changed: false };
		}
		const updated = await this.documents.updateContent(id, this.contentInput(document, merge.contentJson, input));
		return { document: updated, revision: Number(updated.contentRevision) || revision + 1, changedBlocks: merge.changedBlocks, keptBlocks: merge.keptBlocks, changed: true };
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

	private async requirePage(id: ID, organizationId?: ID): Promise<Document> {
		const document = await this.documents.findOneScoped(id, [], organizationId);
		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({ message: 'Markdown applies to PAGE documents only', code: DOCS_NOT_A_PAGE });
		}
		return document;
	}

	/**
	 * The root and, breadth first, what is under it that the caller may read: pages become files, folders become
	 * folders of the zip (a folder has no file of its own), and one the caller may not read is left out with its
	 * subtree. The names are unique within their folder.
	 */
	private async collectSubtree(root: Document, organizationId?: ID): Promise<ISubtreeEntry[]> {
		const entries: ISubtreeEntry[] = [{ document: root, path: 'index.md', hasChildren: false }];
		const folderOf = new Map<string, string>([[String(root.id), '']]);
		const taken = new Map<string, Set<string>>();
		let frontier: Document[] = [root];
		while (frontier.length && entries.length < DOCS_MARKDOWN_SUBTREE_MAX_PAGES) {
			const children = await this.repository.find({
				select: { id: true, parentId: true, index: true },
				where: { parentId: In(frontier.map((node) => node.id as ID)), tenantId: root.tenantId as ID, kind: In([DocumentKindEnum.PAGE, DocumentKindEnum.FOLDER]) } as never,
				order: { index: 'ASC', createdAt: 'ASC' } as never
			});
			const next: Document[] = [];
			for (const child of children) {
				if (entries.length >= DOCS_MARKDOWN_SUBTREE_MAX_PAGES) break;
				let node: Document;
				try {
					node = await this.documents.findOneScoped(child.id as ID, [], organizationId);
				} catch {
					continue; // not the caller's to read: left out, with what is under it
				}
				const parentFolder = folderOf.get(String(child.parentId)) ?? '';
				const parent = entries.find((entry) => String(entry.document.id) === String(child.parentId));
				if (parent) parent.hasChildren = true;
				const slug = markdownFileNameOf(node.name, String(node.id).slice(0, 8)).replace(/\.md$/, '');
				const used = taken.get(parentFolder) ?? new Set<string>();
				let name = slug;
				for (let n = 2; used.has(name); n += 1) name = `${slug}-${n}`;
				used.add(name);
				taken.set(parentFolder, used);
				const folder = posix.join(parentFolder, name);
				folderOf.set(String(node.id), folder);
				if (node.kind === DocumentKindEnum.PAGE) entries.push({ document: node, path: posix.join(folder, 'index.md'), hasChildren: false });
				next.push(node);
			}
			frontier = next;
		}
		// A page without children of its own is a file, not a folder with an index.
		for (const entry of entries) {
			if (entry !== entries[0] && !entry.hasChildren) entry.path = `${posix.dirname(entry.path)}.md`;
		}
		return entries;
	}

	/** The files the pages show, read with the selected organization; one that cannot be read keeps its API link. */
	private async readAssets(entries: ISubtreeEntry[], organizationId?: ID): Promise<Map<string, { name: string; buffer: Buffer }>> {
		const assets = new Map<string, { name: string; buffer: Buffer }>();
		const ids = new Set<string>();
		for (const entry of entries) for (const id of collectFileIds(docOf(entry.document.contentJson))) ids.add(id);
		for (const id of ids) {
			try {
				const file = await this.uploads.getRawFile(id as ID, organizationId);
				const extension = posix.extname(String(file.fileName ?? '')).toLowerCase().replace(/[^a-z0-9.]/g, '');
				assets.set(id, { name: `${id}${extension}`, buffer: file.buffer });
			} catch (error) {
				this.logger.warn(`Markdown export: file ${id} was not added (${(error as Error)?.message ?? error})`);
			}
		}
		return assets;
	}
}

/** The document of a stored column value (the pages' JSON may be text on SQLite). */
export { docOf };
