import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { posix } from 'node:path';
import { In } from 'typeorm';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { DOCS_NOT_A_PAGE } from '../docs.constants';
import { UpdateDocumentContentDTO } from '../dto/update-document-content.dto';
import { UpdateDocumentMarkdownDTO } from '../dto/update-document-markdown.dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { collectDocumentMentionIds } from '../validation/tiptap-schema.validator';
import { DocumentService } from './document.service';
import { DocumentUploadService } from './document-upload.service';
import { docOf, documentToMarkdown, IDocNode, markdownFileNameOf, mergeMarkdownUpdate, rawFileIdOf } from './document-markdown';

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
		const assets = new Map<string, { name: string; buffer: Buffer }>();
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
				linkOfFile: (documentId, url) => this.assetLinkOf(documentId, url, from, assets)
			});
			archive.append(Buffer.from(markdown, 'utf8'), { name: entry.path });
		}
		for (const [fileId, asset] of assets) {
			try {
				const file = await this.uploads.getRawFile(fileId as ID);
				archive.append(file.buffer, { name: `assets/${asset.name}` });
			} catch (error) {
				// A file the caller may not read, or one that is gone: its link in the page stays the API's.
				this.logger.warn(`Markdown export: file ${fileId} was not added (${(error as Error)?.message ?? error})`);
			}
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
			if (input.expectedRevision !== undefined && Number(input.expectedRevision) !== revision) {
				// The route's own answer to a stale writer, even when the text would change nothing.
				await this.documents.updateContent(id, this.contentInput(document, merge.contentJson, input));
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
			mentionEmployeeIds: collectDocumentMentionIds(contentJson) as ID[]
		} as UpdateDocumentContentDTO;
	}

	private async requirePage(id: ID, organizationId?: ID): Promise<Document> {
		const document = await this.documents.findOneScoped(id, [], organizationId);
		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({ message: 'Markdown applies to PAGE documents only', code: DOCS_NOT_A_PAGE });
		}
		return document;
	}

	/** The root and, breadth first, the pages under it the caller may read (one the caller may not read is left out with its subtree), with their places. */
	private async collectSubtree(root: Document, organizationId?: ID): Promise<ISubtreeEntry[]> {
		const entries: ISubtreeEntry[] = [{ document: root, path: 'index.md', hasChildren: false }];
		const folderOf = new Map<string, string>([[String(root.id), '']]);
		let frontier = [root];
		while (frontier.length && entries.length < DOCS_MARKDOWN_SUBTREE_MAX_PAGES) {
			const children = await this.repository.find({
				select: { id: true, parentId: true, index: true },
				where: { parentId: In(frontier.map((page) => page.id as ID)), tenantId: root.tenantId as ID, kind: DocumentKindEnum.PAGE } as never,
				order: { index: 'ASC', createdAt: 'ASC' } as never
			});
			const next: Document[] = [];
			for (const child of children) {
				if (entries.length >= DOCS_MARKDOWN_SUBTREE_MAX_PAGES) break;
				let page: Document;
				try {
					page = await this.documents.findOneScoped(child.id as ID, [], organizationId);
				} catch {
					continue; // not the caller's to read: left out, with what is under it
				}
				const parentFolder = folderOf.get(String(child.parentId)) ?? '';
				const parent = entries.find((entry) => String(entry.document.id) === String(child.parentId));
				if (parent) parent.hasChildren = true;
				const slug = markdownFileNameOf(page.name, String(page.id).slice(0, 8)).replace(/\.md$/, '');
				const folder = posix.join(parentFolder, this.uniqueName(slug, parentFolder, entries));
				folderOf.set(String(page.id), folder);
				entries.push({ document: page, path: posix.join(folder, 'index.md'), hasChildren: false });
				next.push(page);
			}
			frontier = next;
		}
		// A page without children of its own is a file, not a folder with an index.
		for (const entry of entries) {
			if (entry !== entries[0] && !entry.hasChildren) entry.path = `${posix.dirname(entry.path)}.md`;
		}
		return entries;
	}

	private uniqueName(slug: string, folder: string, entries: ISubtreeEntry[]): string {
		const taken = new Set(entries.map((entry) => posix.dirname(entry.path)).filter((dir) => posix.dirname(dir) === folder).map((dir) => posix.basename(dir)));
		let name = slug;
		for (let n = 2; taken.has(name); n += 1) name = `${slug}-${n}`;
		return name;
	}

	/** The relative link of a file the page shows, registering it for the zip's `assets/`. */
	private assetLinkOf(documentId: string, url: string, from: string, assets: Map<string, { name: string; buffer: Buffer }>): string {
		if (!rawFileIdOf(url) && !url.startsWith('/api/plugins/docs/documents/')) return url;
		if (!assets.has(documentId)) assets.set(documentId, { name: `${documentId}`, buffer: Buffer.alloc(0) });
		return posix.relative(from, `assets/${assets.get(documentId)!.name}`);
	}
}

/** The document of a stored column value (the pages' JSON may be text on SQLite). */
export { docOf };
