import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { DocumentImportLayoutEnum, DocumentKindEnum } from '@gauzy/contracts';

/** How a page file is written. */
export type ImportPageFormat = 'markdown' | 'html';

/** One folder, page or attachment the import creates. */
export interface IImportPlanNode {
	/** Stable within the archive: the page file's path, the folder's path, the attachment's path. */
	key: string;
	kind: DocumentKindEnum;
	/** The archive path of the file read for it (none for a plain folder). */
	filePath: string | null;
	/** The folder this node stands for (a plain folder, or the folder a page absorbs). */
	folderPath: string | null;
	/** The node it is created under; null = the import's target. */
	parentKey: string | null;
	/** The name from the file name (a page's export metadata may replace it). */
	name: string;
	/** Its place among its siblings. */
	index: number;
	/** Depth below the target (0 = top level), for parent-first processing. */
	depth: number;
	/** How a page file is written. */
	format?: ImportPageFormat;
}

/** What the import makes of an archive. */
export interface IImportPlan {
	layout: DocumentImportLayoutEnum;
	/** Every node, parents before their children, siblings in name order. */
	nodes: IImportPlanNode[];
	/** Paths left out on purpose: hidden files and folders, archiver droppings. */
	ignored: string[];
}

/** Page file extensions and the format each is read in. */
const PAGE_EXTENSIONS: Readonly<Record<string, ImportPageFormat>> = {
	md: 'markdown',
	markdown: 'markdown',
	mdown: 'markdown',
	html: 'html',
	htm: 'html'
};

/** The trailing id an HTML export gives page files and folders: a space (or `_`/`-`) and 32 hex digits. */
const EXPORT_ID = /[\s_-]([0-9a-f]{32})$/i;

/** A folder an export wraps everything in (`Export-<uuid>`), unwrapped when it is the only top-level entry. */
const EXPORT_WRAPPER = /^export[-_ ][0-9a-f-]{8,}$/i;

/** Files archive tools and desktops leave behind. */
const IGNORED_NAMES = new Set(['thumbs.db', 'desktop.ini']);

/** A file's extension, lower-cased, without the dot. */
export function extensionOf(path: string): string {
	const base = posix.basename(path);
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** A file name without its extension. */
export function stemOf(path: string): string {
	const base = posix.basename(path);
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(0, dot) : base;
}

/** A name without the trailing export id (`Roadmap 3f2a…` → `Roadmap`); a name that is only an id is kept. */
export function stripExportId(name: string): string {
	const stripped = name.replace(EXPORT_ID, '').trim();
	return stripped || name;
}

/** Whether a path is left out: a hidden segment (`.name`), `__MACOSX`, or a desktop's droppings. */
export function isIgnoredPath(path: string): boolean {
	const segments = path.split('/');
	if (segments.some((segment) => segment.startsWith('.') || segment === '__MACOSX')) return true;
	return IGNORED_NAMES.has(segments[segments.length - 1].toLowerCase());
}

/** The format a page file of this layout is read in, or null when the file is an attachment. */
export function pageFormatOf(path: string, layout: DocumentImportLayoutEnum): ImportPageFormat | null {
	const format = PAGE_EXTENSIONS[extensionOf(path)] ?? null;
	// A vault's pages are Markdown; an HTML file in it is an attachment like any other.
	if (format === 'html' && layout === DocumentImportLayoutEnum.MARKDOWN_VAULT) return null;
	return format;
}

/**
 * The layout of an archive from its paths (`docs-import-export` spec FR-3): an HTML export when a page file or a
 * folder carries the export's trailing id, or when its pages are HTML only; a Markdown vault when it holds Markdown
 * pages; null when it holds no page file at all.
 *
 * @param paths The archive's file paths (normalized).
 * @param directories The archive's folders.
 */
export function detectImportLayout(paths: readonly string[], directories: readonly string[] = []): DocumentImportLayoutEnum | null {
	const visible = paths.filter((path) => !isIgnoredPath(path));
	const markdown = visible.filter((path) => PAGE_EXTENSIONS[extensionOf(path)] === 'markdown');
	const html = visible.filter((path) => PAGE_EXTENSIONS[extensionOf(path)] === 'html');
	if (!markdown.length && !html.length) return null;
	const withId = [...markdown, ...html].some((path) => EXPORT_ID.test(stemOf(path)));
	const folderWithId = directories.filter((path) => !isIgnoredPath(path)).some((path) => EXPORT_ID.test(posix.basename(path)));
	if (withId || folderWithId) return DocumentImportLayoutEnum.HTML_EXPORT;
	if (!markdown.length) return DocumentImportLayoutEnum.HTML_EXPORT;
	return DocumentImportLayoutEnum.MARKDOWN_VAULT;
}

/** Natural, case-insensitive name order (`Page 2` before `Page 10`), the path breaking ties. */
function byName(a: { name: string; key: string }, b: { name: string; key: string }): number {
	return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/**
 * Builds the tree the import creates from an archive's paths (`docs-import-export` spec FR-6, FR-11):
 *
 * - every folder is a FOLDER, every page file a PAGE, every other file a FILE (an attachment);
 * - a page file and a folder of the same name (`Roadmap.md` + `Roadmap/`, or the export's `Roadmap <id>.md` +
 *   `Roadmap <id>/`), or a folder's `index.md` / `<folder>.md` (a folder note), are ONE page holding the folder's
 *   content as sub-pages;
 * - hidden files and folders and `__MACOSX` are ignored, and a single `Export-<uuid>` wrapper folder is unwrapped;
 * - names come from the file names (without extension, without the export's id); siblings are in name order.
 *
 * Attachments are planned under their folder's node; the runner moves each one under the page that first shows it.
 *
 * @param paths The archive's file paths (normalized).
 * @param directories The archive's folders (normalized).
 * @param layout The detected layout.
 */
export function buildImportPlan(paths: readonly string[], directories: readonly string[], layout: DocumentImportLayoutEnum): IImportPlan {
	const ignored: string[] = [];
	const files = paths.filter((path) => {
		if (isIgnoredPath(path)) {
			ignored.push(path);
			return false;
		}
		return true;
	});
	const folders = new Set(directories.filter((path) => !isIgnoredPath(path)));
	for (const path of files) {
		const segments = path.split('/');
		for (let i = 1; i < segments.length; i++) folders.add(segments.slice(0, i).join('/'));
	}

	// One `Export-<uuid>` wrapper around everything is not part of the workspace.
	const tops = new Set([...files.map((path) => path.split('/')[0]), ...[...folders].map((path) => path.split('/')[0])]);
	let strip = '';
	if (tops.size === 1) {
		const [top] = [...tops];
		if (folders.has(top) && EXPORT_WRAPPER.test(top)) strip = `${top}/`;
	}

	const pagePaths = files.filter((path) => pageFormatOf(path, layout) !== null);
	const pageSet = new Set(pagePaths);
	// Page files by folder and stem: `Roadmap.md` beside `Roadmap/`.
	const pageByFolderAndStem = new Map<string, string>();
	for (const path of pagePaths) {
		const key = `${posix.dirname(path)}|${stemOf(path)}`;
		if (!pageByFolderAndStem.has(key)) pageByFolderAndStem.set(key, path);
	}
	// The page each folder becomes, when it becomes one. A page stands for one folder at most: first the folder it is the
	// index or the folder note of (`Team/index.md`), then — for the pages still free — the folder beside it of the same
	// name (`Roadmap.md` + `Roadmap/`). Claimed twice (`Team/index.md` + a folder `Team/index/`), a page would be its
	// own parent and its whole tree unreachable.
	const pageOfFolder = new Map<string, string>();
	const claimed = new Set<string>();
	const candidates = [...folders].filter((folder) => !(strip && `${folder}/` === strip));
	for (const folder of candidates) {
		const base = posix.basename(folder);
		const inside = ['index.md', 'index.html', `${base}.md`].map((name) => `${folder}/${name}`).find((path) => pageSet.has(path) && !claimed.has(path));
		if (inside) {
			pageOfFolder.set(folder, inside);
			claimed.add(inside);
		}
	}
	for (const folder of candidates) {
		if (pageOfFolder.has(folder)) continue;
		const sibling = pageByFolderAndStem.get(`${posix.dirname(folder)}|${posix.basename(folder)}`);
		if (sibling && !claimed.has(sibling)) {
			pageOfFolder.set(folder, sibling);
			claimed.add(sibling);
		}
	}
	const folderOfPage = new Map<string, string>([...pageOfFolder].map(([folder, page]) => [page, folder]));

	/** The node key that holds what is directly inside `folder` ('' = the target). */
	const containerOf = (folder: string): string | null => {
		if (!folder || folder === '.' || `${folder}/` === strip) return null;
		return pageOfFolder.get(folder) ?? folder;
	};

	const nodes: IImportPlanNode[] = [];
	for (const folder of folders) {
		if (`${folder}/` === strip || pageOfFolder.has(folder)) continue;
		const parent = posix.dirname(folder) === '.' ? '' : posix.dirname(folder);
		nodes.push(node(folder, DocumentKindEnum.FOLDER, null, folder, containerOf(parent), posix.basename(folder), layout));
	}
	for (const path of files) {
		const format = pageFormatOf(path, layout);
		const folder = posix.dirname(path) === '.' ? '' : posix.dirname(path);
		if (format) {
			const absorbed = folderOfPage.get(path) ?? null;
			// A page that stands for the folder it sits in (`index.md`, a folder note) is under that folder's parent.
			const insideOwnFolder = absorbed !== null && absorbed === folder;
			const parentFolder = insideOwnFolder ? (posix.dirname(folder) === '.' ? '' : posix.dirname(folder)) : folder;
			const name = insideOwnFolder ? posix.basename(folder) : stemOf(path);
			const page = node(path, DocumentKindEnum.PAGE, path, absorbed, containerOf(parentFolder), name, layout);
			page.format = format;
			nodes.push(page);
		} else {
			nodes.push(node(path, DocumentKindEnum.FILE, path, null, containerOf(folder), posix.basename(path), layout));
		}
	}

	// Siblings in name order, then parents before children.
	const byParent = new Map<string | null, IImportPlanNode[]>();
	for (const item of nodes) {
		const list = byParent.get(item.parentKey) ?? [];
		list.push(item);
		byParent.set(item.parentKey, list);
	}
	const ordered: IImportPlanNode[] = [];
	let frontier: (string | null)[] = [null];
	let depth = 0;
	const visited = new Set<string>();
	while (frontier.length) {
		const next: string[] = [];
		for (const parentKey of frontier) {
			const children = (byParent.get(parentKey) ?? []).sort(byName);
			children.forEach((child, index) => {
				if (visited.has(child.key)) return;
				visited.add(child.key);
				child.index = index;
				child.depth = depth;
				ordered.push(child);
				if (child.kind !== DocumentKindEnum.FILE) next.push(child.key);
			});
		}
		frontier = next;
		depth += 1;
	}
	// Belt and braces: a node the walk could not reach (a parent cycle the rules above should never produce) is imported at
	// the top rather than silently left out.
	const stranded = nodes.filter((item) => !visited.has(item.key)).sort(byName);
	stranded.forEach((item, index) => {
		item.parentKey = null;
		item.index = (byParent.get(null)?.length ?? 0) + index;
		item.depth = 0;
		ordered.push(item);
	});
	return { layout, nodes: ordered, ignored };
}

function node(
	key: string,
	kind: DocumentKindEnum,
	filePath: string | null,
	folderPath: string | null,
	parentKey: string | null,
	rawName: string,
	layout: DocumentImportLayoutEnum
): IImportPlanNode {
	const name = layout === DocumentImportLayoutEnum.HTML_EXPORT && kind !== DocumentKindEnum.FILE ? stripExportId(rawName) : rawName;
	return { key, kind, filePath, folderPath, parentKey, name: name.slice(0, 255) || 'Untitled', index: 0, depth: 0 };
}

/** The `externalId` of a node: a digest of its key (a path may be longer than the column). */
export function externalIdOf(key: string): string {
	return createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 64);
}

// ---------------------------------------------------------------- link resolution

/** What a link inside a page points at: a page (or a page that stands for a folder) or an attachment. */
export interface IImportLinkTarget {
	kind: 'page' | 'file';
	key: string;
}

/** Lower-cased, for the case-insensitive lookups of links. */
const fold = (value: string): string => value.normalize('NFC').toLowerCase();

/**
 * Resolves the links of the pages of a plan to its nodes (`docs-import-export` spec FR-8):
 *
 * - **wiki links** (`[[Page]]`, `[[Folder/Page]]`, `[[Page.md]]`): by the page's name (case-insensitive, the export's
 *   id ignored), a path-qualified target by its path; with several pages of one name, the one in the linking page's
 *   folder, then the shortest path;
 * - **embeds** (`![[diagram.png]]`): an attachment by its file name, by the same preference; a target without an
 *   attachment's extension is a page;
 * - **relative links** (`Other%20Page%20<id>.md`, `../x.html`, `img/a.png`): resolved against the linking page's
 *   folder, then against the archive root.
 */
export class ImportLinkIndex {
	private readonly pageByPath = new Map<string, string>();
	private readonly pagesByName = new Map<string, string[]>();
	private readonly fileByPath = new Map<string, string>();
	private readonly filesByName = new Map<string, string[]>();
	private readonly pathOfKey = new Map<string, string>();

	constructor(plan: IImportPlan) {
		for (const item of plan.nodes) {
			if (item.kind === DocumentKindEnum.PAGE && item.filePath) {
				const withoutExtension = item.filePath.slice(0, item.filePath.length - extensionOf(item.filePath).length - 1);
				this.pathOfKey.set(item.key, item.filePath);
				this.pageByPath.set(fold(item.filePath), item.key);
				this.pageByPath.set(fold(withoutExtension), item.key);
				if (item.folderPath) {
					this.pageByPath.set(fold(item.folderPath), item.key);
				}
				for (const name of new Set([stemOf(item.filePath), stripExportId(stemOf(item.filePath)), item.name])) {
					push(this.pagesByName, fold(name), item.key);
				}
			} else if (item.kind === DocumentKindEnum.FILE && item.filePath) {
				this.pathOfKey.set(item.key, item.filePath);
				this.fileByPath.set(fold(item.filePath), item.key);
				push(this.filesByName, fold(posix.basename(item.filePath)), item.key);
			}
		}
	}

	/**
	 * A wiki link's or an embed's target (`Page`, `Folder/Page`, `Page#Heading` without the heading, `file.png`).
	 *
	 * @param target The target as written (alias and heading already removed).
	 * @param fromPath The linking page's archive path.
	 * @param embed Whether it is an embed (`![[…]]`), which prefers an attachment.
	 */
	resolveWiki(target: string, fromPath: string, embed = false): IImportLinkTarget | null {
		const clean = target.replace(/\\/g, '/').replace(/^\/+/, '').trim();
		if (!clean) return null;
		const extension = extensionOf(clean);
		const pageExtension = PAGE_EXTENSIONS[extension] !== undefined;
		const fromFolder = posix.dirname(fromPath);
		// An embed, or a target with an attachment's extension, is an attachment first; anything else a page first.
		const fileFirst = !pageExtension && (embed || /^[a-z0-9]{1,8}$/.test(extension));
		const file = (): IImportLinkTarget | null => {
			const byPath = this.fileByPath.get(fold(clean)) ?? this.fileByPath.get(fold(posix.join(fromFolder, clean)));
			const key = byPath ?? this.pick(this.filesByName.get(fold(posix.basename(clean))), fromFolder, clean);
			return key ? { kind: 'file', key } : null;
		};
		const page = (): IImportLinkTarget | null => {
			const stripped = pageExtension ? clean.slice(0, clean.length - extension.length - 1) : clean;
			const key = stripped.includes('/')
				? this.pageByPath.get(fold(stripped)) ??
					this.pageByPath.get(fold(posix.join(fromFolder, stripped))) ??
					this.pick(this.pagesByName.get(fold(posix.basename(stripped))), fromFolder, stripped)
				: this.pick(this.pagesByName.get(fold(stripped)), fromFolder, stripped);
			return key ? { kind: 'page', key } : null;
		};
		return fileFirst ? file() ?? page() : page() ?? file();
	}

	/**
	 * A relative link of a Markdown or HTML page (`Other%20Page.md`, `../x.html#part`, `img/a.png`), or null when it is
	 * not one (a scheme, a protocol-relative or absolute URL, a bare fragment) or points at nothing the archive holds.
	 *
	 * @param href The link as written.
	 * @param fromPath The linking page's archive path.
	 */
	resolveRelative(href: string, fromPath: string): IImportLinkTarget | null {
		const raw = String(href ?? '').trim();
		if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
		let path = raw.replace(/[?#].*$/, '');
		try {
			path = decodeURIComponent(path);
		} catch {
			// a malformed escape: the link is used as written
		}
		path = path.replace(/\\/g, '/');
		const candidates = [posix.normalize(posix.join(posix.dirname(fromPath), path)), posix.normalize(path.replace(/^\/+/, ''))];
		for (const candidate of candidates) {
			if (candidate.startsWith('..') || candidate.startsWith('/')) continue;
			const page = this.pageByPath.get(fold(candidate)) ?? this.pageByPath.get(fold(candidate.replace(/\/+$/, '')));
			if (page) return { kind: 'page', key: page };
			const file = this.fileByPath.get(fold(candidate));
			if (file) return { kind: 'file', key: file };
		}
		return null;
	}

	/**
	 * Of several candidates: for a path-qualified target (`B/Page`), the one at that path; then the one in `fromFolder`,
	 * then one whose path ends with the target, then the shortest path.
	 */
	private pick(keys: string[] | undefined, fromFolder: string, target: string): string | null {
		if (!keys?.length) return null;
		if (keys.length === 1) return keys[0];
		const pathOf = (key: string) => this.pathOfKey.get(key) ?? key;
		if (target.includes('/')) {
			const wanted = fold(target.replace(/\.[^/.]+$/, ''));
			const atPath = keys.find((key) => {
				const stem = fold(pathOf(key)).replace(/\.[^/.]+$/, '');
				return stem === wanted || stem.endsWith(`/${wanted}`);
			});
			if (atPath) return atPath;
		}
		const sameFolder = keys.find((key) => posix.dirname(pathOf(key)) === fromFolder);
		if (sameFolder) return sameFolder;
		const suffix = keys.find((key) => fold(pathOf(key)).includes(`/${fold(target)}`));
		if (suffix) return suffix;
		return [...keys].sort((a, b) => pathOf(a).length - pathOf(b).length || (pathOf(a) < pathOf(b) ? -1 : 1))[0];
	}
}

function push(map: Map<string, string[]>, key: string, value: string): void {
	const list = map.get(key) ?? [];
	if (!list.includes(value)) list.push(value);
	map.set(key, list);
}
