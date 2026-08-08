import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { sanitizeMediaUrl } from '../../editor/read-only/safe-url.util';

/** Breadcrumb segment above the grid ("All documents / Finance / Invoices"). */
export interface IDocsCardsCrumb {
	id: ID | null;
	name: string;
}

/** List rows carry `childrenCount`/`hasChildren` (backend list projection). */
type DocsCardRow = IDocument & { childrenCount?: number; isArchived?: boolean };

/**
 * Cards view (`01-ux-spec.md` §4.2): folder cards first (icon/color, name,
 * child count, drill-in), then document cards (kind/mime icon, name, badge
 * row, category chips, updated + size footer). A breadcrumb row above the
 * grid tracks the current tree location; "Load more" appends the next batch.
 * With an active search/preset/facet the grid flattens (no folder cards) and
 * shows the `DOCS.CARDS.FLAT_RESULTS_HINT` bar.
 */
@Component({
	selector: 'gz-docs-cards',
	templateUrl: './docs-cards.component.html',
	styleUrls: ['./docs-cards.component.scss'],
	standalone: false
})
export class DocsCardsComponent extends TranslationBaseComponent {
	@Input() rows: DocsCardRow[] = [];
	@Input() totalCount = 0;
	@Input() loading = false;
	/** Flat results mode: search or a non-All preset active — folder cards hidden. */
	@Input() flat = false;
	/** Ancestor chain of the current tree location; empty = root. */
	@Input() breadcrumb: IDocsCardsCrumb[] = [];
	/** Card whose detail panel is open gets `active` styling. */
	@Input() activeId: ID | null = null;

	// `TranslationBaseComponent` carries no Angular decorator, so an inherited
	// constructor is not injectable under AOT (NG2006) — declare it explicitly.
	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	/** Card body click — opens the detail panel (`01-ux-spec.md` §4.2). */
	@Output() open = new EventEmitter<IDocument>();
	/** FILE card preview affordance — the browse page opens `gz-docs-preview-modal`. */
	@Output() preview = new EventEmitter<IDocument>();
	/** PAGE card open-in-editor affordance. */
	@Output() openEditor = new EventEmitter<IDocument>();
	/** Folder card click — sets the tree location (`?folder=`); `null` = root crumb. */
	@Output() drillIn = new EventEmitter<ID | null>();
	@Output() loadMore = new EventEmitter<void>();

	public readonly kindEnum = DocumentKindEnum;

	/**
	 * Documents whose thumbnail failed to load — a signed provider URL that expired between
	 * the list response and the `<img>` fetch, or a thumbnail deleted from storage. Recorded
	 * per card so the row falls back to its kind icon instead of rendering a broken image.
	 */
	private readonly failedThumbnails = new Set<string>();

	get folderCards(): DocsCardRow[] {
		return this.flat ? [] : this.rows.filter((row) => row.kind === DocumentKindEnum.FOLDER);
	}

	get documentCards(): DocsCardRow[] {
		return this.flat ? this.rows : this.rows.filter((row) => row.kind !== DocumentKindEnum.FOLDER);
	}

	get hasMore(): boolean {
		return this.rows.length < this.totalCount;
	}

	onCardClick(row: DocsCardRow): void {
		if (row.kind === DocumentKindEnum.FOLDER) {
			this.drillIn.emit(row.id as ID);
		} else {
			this.open.emit(row);
		}
	}

	onCrumbClick(crumb: IDocsCardsCrumb): void {
		this.drillIn.emit(crumb.id);
	}

	/** Per-kind default open (card kebab / double click), mirroring the table. */
	onDefaultOpen(row: DocsCardRow, event?: Event): void {
		event?.stopPropagation();
		if (row.kind === DocumentKindEnum.FILE) {
			this.preview.emit(row);
		} else if (row.kind === DocumentKindEnum.PAGE) {
			this.openEditor.emit(row);
		} else {
			this.drillIn.emit(row.id as ID);
		}
	}

	isActive(row: DocsCardRow): boolean {
		return this.activeId != null && String(this.activeId) === String(row.id);
	}

	kindIcon(row: DocsCardRow): string {
		switch (row.kind) {
			case DocumentKindEnum.FOLDER:
				return 'folder-outline';
			case DocumentKindEnum.PAGE:
				return 'file-text-outline';
			default:
				return this.fileIcon(row.mimeType);
		}
	}

	/**
	 * The card's preview image, or `null` when it must fall back to the kind icon.
	 *
	 * `thumbUrl` is a **virtual** column the backend resolves from `storageProvider` +
	 * `thumbKey` (`document.subscriber.ts`), so it is absent until the P1 thumbnail job has
	 * run — most rows will never have one, and every row must look finished without it.
	 *
	 * 🛑 The URL is provider-supplied and goes straight into `<img [src]>`, so it goes through
	 * the app's scheme allowlist first. Angular's own URL check is a denylist of exactly one
	 * scheme (see `editor/read-only/safe-url.util.ts`), which would let a stored
	 * `data:text/html` or `vbscript:` value through untouched.
	 */
	thumbnailUrl(row: DocsCardRow): string | null {
		if (!row?.thumbUrl || this.failedThumbnails.has(String(row.id))) return null;
		return sanitizeMediaUrl(row.thumbUrl);
	}

	/** A thumbnail that 404s or expires degrades to the kind icon rather than a broken image. */
	onThumbnailError(row: DocsCardRow): void {
		this.failedThumbnails.add(String(row.id));
	}

	humanizeSize(bytes?: number): string {
		if (!bytes || bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	trackById(_: number, row: DocsCardRow): string {
		return String(row.id);
	}

	private fileIcon(mimeType?: string): string {
		if (!mimeType) return 'file-outline';
		if (mimeType === 'application/pdf') return 'file-text-outline';
		if (mimeType.startsWith('image/')) return 'image-outline';
		if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'film-outline';
		if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel'))
			return 'grid-outline';
		if (mimeType.includes('word') || mimeType.includes('opendocument.text')) return 'file-text-outline';
		return 'file-outline';
	}
}
