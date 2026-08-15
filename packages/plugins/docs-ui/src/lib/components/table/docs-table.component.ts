import {
	Component,
	EventEmitter,
	HostListener,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	Output,
	SimpleChanges
} from '@angular/core';
import { NbMenuService } from '@nebular/theme';
import { Cell, IColumns, LocalDataSource, Settings } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { filter } from 'rxjs/operators';
import { DocumentKindEnum, ID, IDocument, PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	buildDocsActionMenu,
	docsActionOf,
	toDocsActionTarget,
	IDocsActionMenuContext
} from '../actions/docs-action-menu';
import { DocsRowActionsService } from '../actions/docs-row-actions.service';
import { DocumentPermissionService } from '../../services/document-permission.service';
import { RowActionsComponent } from './cells/row-actions.component';
import {
	DOCS_TABLE_COLUMN_KEYS,
	DOCS_TABLE_COLUMN_TITLE_KEYS,
	DOCS_TABLE_REQUIRED_COLUMNS,
	DocsTableColumnKey,
	DocsTableColumnPreferences,
	isNarrowViewport,
	readDocsTableColumnPreferences,
	resolveDocsTableColumns,
	writeDocsTableColumnPreferences
} from './docs-table-columns.model';
import { CategoryChipsComponent } from './cells/category-chips.component';
import { KnowledgeBadgeComponent } from './cells/knowledge-badge.component';
import { NameCellComponent } from './cells/name-cell.component';
import { SourceBadgeComponent } from './cells/source-badge.component';
import { StatusBadgeComponent } from './cells/status-badge.component';
import { TagChipsComponent } from './cells/tag-chips.component';

/** Nebular menu-tag prefix for the per-row kebab; the suffix is the document id. */
const ROW_MENU_TAG_PREFIX = 'gz-docs-row-actions-';

/**
 * Server-paginated documents table (`angular2-smart-table`, external mode —
 * pagination renders outside via the shared `ga-pagination`). Column set and
 * renderers per `04-frontend-plugin.md` §4.3.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-table',
	templateUrl: './docs-table.component.html',
	styleUrls: ['./docs-table.component.scss'],
	standalone: false
})
export class DocsTableComponent extends TranslationBaseComponent implements OnInit, OnChanges, OnDestroy {
	/**
	 * How long a single click waits to see whether it is really the first half of a double click.
	 * Comfortably inside the platform double-click threshold, and short enough that opening the detail
	 * panel still feels immediate.
	 */
	private static readonly DOUBLE_CLICK_GRACE_MS = 250;
	private pendingRowOpen: ReturnType<typeof setTimeout> | null = null;

	@Input() rows: IDocument[] = [];
	@Input() loading = false;
	/** Renders selection checkboxes (DOCS_MANAGE — plus DOCS_REVIEW on the review queue). */
	@Input() selectable = false;
	/** Reduced column set for the review queue. */
	@Input() reviewMode = false;

	@Output() rowClicked = new EventEmitter<IDocument>();
	@Output() folderOpened = new EventEmitter<IDocument>();
	@Output() selectionChanged = new EventEmitter<ID[]>();
	@Output() sortChanged = new EventEmitter<{ field: string; order: 'ASC' | 'DESC' }>();
	@Output() retryRequested = new EventEmitter<IDocument>();
	/** Double-click on a FILE row — the browse page opens `gz-docs-preview-modal`. */
	@Output() previewRequested = new EventEmitter<IDocument>();
	/** Double-click on a PAGE row — opens the editor route. */
	@Output() editorRequested = new EventEmitter<IDocument>();

	/**
	 * `angular2-smart-table` types `[settings]` as `Settings`, whose `columns` is
	 * required — a bare `Record<string, unknown>` fails the AOT template check
	 * even though it works at runtime. Seeded with empty columns so the binding
	 * is valid before `buildSettings()` runs.
	 */
	public settings: Settings = { columns: {} };
	public source = new LocalDataSource();

	/** Columns the chooser offers (everything except the always-on Name column). */
	public readonly selectableColumns: DocsTableColumnKey[] = DOCS_TABLE_COLUMN_KEYS.filter(
		(key) => !DOCS_TABLE_REQUIRED_COLUMNS.includes(key)
	);
	/** Effective visibility — stored preference over the narrow-viewport defaults. */
	public columnVisibility: Record<DocsTableColumnKey, boolean> = resolveDocsTableColumns({}, false);

	/** Only the columns the user explicitly toggled; the rest follow the defaults. */
	private columnPreferences: DocsTableColumnPreferences = {};
	/** Last evaluated breakpoint state — a resize only rebuilds when it flips. */
	private narrowViewport = false;

	/** Permission flags backing the row kebab (`01-ux-spec.md` §3.5 is permission-filtered). */
	private permissions = { create: false, update: false, delete: false, aiImport: false };

	constructor(
		public readonly translateService: TranslateService,
		private readonly rowActions: DocsRowActionsService,
		private readonly documentPermission: DocumentPermissionService,
		private readonly nbMenuService: NbMenuService,
		private readonly permissionsService: NgxPermissionsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.columnPreferences = readDocsTableColumnPreferences();
		this.narrowViewport = isNarrowViewport();
		this.resolveColumns();
		this.buildSettings();
		this._applyTranslationOnSmartTable();

		// The kebab items are permission-filtered, and a star toggled anywhere flips
		// the Favorite/Unfavorite label — both rebuild the rendered menus.
		this.permissionsService.permissions$.pipe(untilDestroyed(this)).subscribe((permissions) => {
			this.permissions = {
				create: !!permissions[PermissionsEnum.DOCS_CREATE],
				update: !!permissions[PermissionsEnum.DOCS_UPDATE],
				delete: !!permissions[PermissionsEnum.DOCS_DELETE],
				aiImport: !!permissions[PermissionsEnum.DOCS_AI_IMPORT]
			};
			this.buildSettings();
		});
		this.rowActions.favoriteIds$.pipe(untilDestroyed(this)).subscribe(() => this.buildSettings());

		// ONE subscription for the whole table: the clicked row is carried by the
		// menu tag, so a per-row subscription (25 of them on a default page) is not
		// needed — the tree resolves its context menu the same way.
		this.nbMenuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => (tag ?? '').startsWith(ROW_MENU_TAG_PREFIX)),
				untilDestroyed(this)
			)
			.subscribe(({ tag, item }) => {
				const id = tag.slice(ROW_MENU_TAG_PREFIX.length);
				// A menu click cannot be awaited; `execute()` owns its failure path.
				void this.onRowAction(docsActionOf(item), id);
			});
		this.source.onChanged().pipe(untilDestroyed(this)).subscribe((change: { action?: string; sort?: { field: string; direction: string }[] }) => {
			if (change?.action === 'sort' && change.sort?.length) {
				const [sort] = change.sort;
				this.sortChanged.emit({
					field: sort.field,
					order: sort.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
				});
			}
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['rows']) {
			void this.source.load(this.rows ?? []);
		}
		if (changes['selectable'] || changes['reviewMode']) {
			this.buildSettings();
		}
	}

	/**
	 * The `< lg` defaults only apply while the viewport is actually narrow, so the
	 * breakpoint is re-evaluated on resize — but the settings object is rebuilt only
	 * when the flag flips, never on every resize frame.
	 */
	@HostListener('window:resize')
	onWindowResize(): void {
		const narrow = isNarrowViewport();
		if (narrow === this.narrowViewport) return;
		this.narrowViewport = narrow;
		this.resolveColumns();
		this.buildSettings();
	}

	// ─── Column chooser (`01-ux-spec.md` §4.1) ───────────────────

	isColumnVisible(column: DocsTableColumnKey): boolean {
		return this.columnVisibility[column] !== false;
	}

	columnTitleKey(column: DocsTableColumnKey): string {
		return DOCS_TABLE_COLUMN_TITLE_KEYS[column];
	}

	/** Persists the choice as an explicit preference — it outranks the breakpoint defaults. */
	toggleColumn(column: DocsTableColumnKey, visible: boolean): void {
		if (DOCS_TABLE_REQUIRED_COLUMNS.includes(column)) return;
		this.columnPreferences = { ...this.columnPreferences, [column]: visible };
		writeDocsTableColumnPreferences(this.columnPreferences);
		this.resolveColumns();
		this.buildSettings();
	}

	private resolveColumns(): void {
		this.columnVisibility = resolveDocsTableColumns(this.columnPreferences, this.narrowViewport);
	}

	/**
	 * SELECTION ONLY — opening a row is `onRowClick`'s job.
	 *
	 * This used to open the detail panel too, which meant the panel was unreachable by row click for
	 * exactly the users most likely to want it. `angular2-smart-table` only emits `userRowSelect` for a
	 * row-BODY click when `selectMode === 'single'` (`onUserSelectRow` early-returns otherwise), and
	 * `buildSettings()` runs this grid in `'multi'` whenever `selectable` is on — i.e. for anyone with
	 * DOCS_MANAGE. So an admin clicking a document row got nothing at all.
	 *
	 * The mirror-image defect: `onMultipleSelectRow` DOES emit it, so ticking a checkbox for a bulk
	 * action also opened the detail panel. Both go away by making this handler do one thing.
	 */
	onUserRowSelect(event: { data?: IDocument | null; selected?: IDocument[] }): void {
		if (event?.selected) {
			this.selectionChanged.emit(event.selected.map((row) => row.id as ID));
		}
	}

	/**
	 * Single-click row open (`01-ux-spec.md` §4.1): folders drill in, everything else opens the detail
	 * panel. Handled on the container for the reason above — the grid's own output is not delivered in
	 * multi-select mode.
	 */
	onRowClick(event: MouseEvent): void {
		const target = event.target as HTMLElement | null;
		// The multi-select cell selects; it must never also open. Interactive controls (the row kebab,
		// the status Retry button, the sortable column headers' anchors) own their own click.
		if (target?.closest?.('.angular2-smart-action-multiple-select, button, a, input, nb-checkbox')) return;
		const index = this.resolveRowIndex(event);
		if (index === undefined) return;
		// A double click delivers two `click` events BEFORE `dblclick`, so acting immediately would open
		// the detail panel on the way to the editor/preview — and drill a folder TWICE, since both
		// handlers emit `folderOpened`. Defer past the double-click window; `onRowDoubleClick` cancels.
		this.cancelPendingRowOpen();
		this.pendingRowOpen = setTimeout(() => {
			this.pendingRowOpen = null;
			void this.resolveRowAt(index).then((data) => {
				if (!data) return;
				if (data.kind === DocumentKindEnum.FOLDER) {
					this.folderOpened.emit(data);
				} else {
					this.rowClicked.emit(data);
				}
			});
		}, DocsTableComponent.DOUBLE_CLICK_GRACE_MS);
	}

	/**
	 * Per-kind default open on double click (`01-ux-spec.md` §4.1) — folder drill,
	 * page editor, file preview.
	 */
	onRowDoubleClick(event: MouseEvent): void {
		this.cancelPendingRowOpen();
		const index = this.resolveRowIndex(event);
		if (index === undefined) return;
		void this.resolveRowAt(index).then((data) => {
			if (!data) return;
			switch (data.kind) {
				case DocumentKindEnum.FOLDER:
					this.folderOpened.emit(data);
					break;
				case DocumentKindEnum.PAGE:
					this.editorRequested.emit(data);
					break;
				default:
					this.previewRequested.emit(data);
			}
		});
	}

	/**
	 * DOM index of the clicked DATA row, or undefined when the click was not on one.
	 *
	 * `angular2-smart-table` exposes no click/dblclick output carrying the row, so position is all we
	 * have. Restricted to `<tbody>` on purpose: the header and filter rows are `<tr>`s too, and a click
	 * on a column header's padding (outside its sort anchor) would otherwise resolve to index 0 and
	 * open the first document. Expanded detail rows are skipped so they cannot shift the mapping.
	 */
	private resolveRowIndex(event: MouseEvent): number | undefined {
		const row = (event.target as HTMLElement)?.closest?.('tr');
		const body = row?.parentElement;
		if (!row || !body || body.tagName !== 'TBODY') return undefined;
		const dataRows = Array.from(body.children).filter(
			(el) => el.tagName === 'TR' && !el.classList.contains('angular2-smart-row-detail')
		);
		const index = dataRows.indexOf(row);
		return index >= 0 ? index : undefined;
	}

	/**
	 * Resolves a rendered row index to its document.
	 *
	 * Indexed against what the grid actually RENDERS, not the `rows` input: `LocalDataSource` applies
	 * its own sort and paging, so after a sort the DOM order no longer matches the array it was loaded
	 * from and an index into `rows` would open a different document than the one clicked.
	 */
	private async resolveRowAt(index: number): Promise<IDocument | undefined> {
		const rendered = (await this.source.getElements().catch(() => [] as IDocument[])) as IDocument[];
		return rendered?.[index] ?? this.rows?.[index];
	}

	private cancelPendingRowOpen(): void {
		if (this.pendingRowOpen) {
			clearTimeout(this.pendingRowOpen);
			this.pendingRowOpen = null;
		}
	}

	ngOnDestroy(): void {
		this.cancelPendingRowOpen();
	}

	// ─── Row actions (`01-ux-spec.md` §4.1 column 9) ─────────────

	private menuContext(row: IDocument): IDocsActionMenuContext {
		return {
			surface: 'row',
			translate: (key: string) => this.getTranslation(key),
			isFavorite: this.rowActions.isFavorite(row?.id as ID),
			// Ownership half of the write rule (spec 08 §1.7). `createdByUserId` and
			// `visibility` are both in the list projection, so the row already carries it.
			canMutate: this.documentPermission.canMutate(row),
			permissions: this.permissions
		};
	}

	/**
	 * Routes one kebab click.
	 *
	 * The three **view** actions stay with the table because only the hosting page
	 * knows what "open" means here (the preview modal, the editor route, the detail
	 * panel) — they reuse the outputs the double-click handler already emits.
	 * Everything else is the shared executor, so a rename from the table behaves
	 * exactly like a rename from the tree.
	 */
	private async onRowAction(action: ReturnType<typeof docsActionOf>, id: string): Promise<void> {
		const row = (this.rows ?? []).find((candidate) => String(candidate.id) === id);
		if (!row || !action) return;
		switch (action) {
			case 'details':
				this.rowClicked.emit(row);
				return;
			case 'preview':
				this.previewRequested.emit(row);
				return;
			case 'open':
				if (row.kind === DocumentKindEnum.FOLDER) this.folderOpened.emit(row);
				else if (row.kind === DocumentKindEnum.PAGE) this.editorRequested.emit(row);
				else this.previewRequested.emit(row);
				return;
			default:
				await this.rowActions.execute(action, toDocsActionTarget(row));
		}
	}

	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildSettings());
	}

	private buildSettings(): void {
		const columns: Record<string, unknown> = {
			name: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['name']),
				type: 'custom',
				isSortable: true,
				isFilterable: false,
				renderComponent: NameCellComponent,
				componentInitFunction: (instance: NameCellComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue() as string;
				}
			},
			categories: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['categories']),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: CategoryChipsComponent,
				componentInitFunction: (instance: CategoryChipsComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			tags: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['tags']),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: TagChipsComponent,
				componentInitFunction: (instance: TagChipsComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			status: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['status']),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: StatusBadgeComponent,
				componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.retryHandler = (document: IDocument) => this.retryRequested.emit(document);
				}
			},
			knowledge: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['knowledge']),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: KnowledgeBadgeComponent,
				componentInitFunction: (instance: KnowledgeBadgeComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			source: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['source']),
				type: 'custom',
				isSortable: true,
				isFilterable: false,
				renderComponent: SourceBadgeComponent,
				componentInitFunction: (instance: SourceBadgeComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			fileSize: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['fileSize']),
				type: 'text',
				isSortable: true,
				isFilterable: false,
				valuePrepareFunction: (value: number) => this.humanizeSize(value)
			},
			updatedAt: {
				title: this.getTranslation(DOCS_TABLE_COLUMN_TITLE_KEYS['updatedAt']),
				type: 'text',
				isSortable: true,
				isFilterable: false,
				valuePrepareFunction: (value: string | Date) => (value ? new Date(value).toLocaleString() : '')
			},
			// Column 9 (`01-ux-spec.md` §4.1): the row kebab, carrying the same action
			// set as the tree context menu plus Details and (FILE) Preview. It is
			// deliberately NOT part of the column chooser — it is the only way to reach
			// most per-row actions, so hiding it would strand them, which is why
			// `docs-table-columns.model.ts` leaves it out of `DOCS_TABLE_COLUMN_KEYS`.
			actions: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.ACTIONS'),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: RowActionsComponent,
				componentInitFunction: (instance: RowActionsComponent, cell: Cell) => {
					const row = cell.getRow().getData() as IDocument;
					instance.rowData = row;
					instance.tag = `${ROW_MENU_TAG_PREFIX}${row?.id}`;
					instance.menuItems = buildDocsActionMenu(toDocsActionTarget(row), this.menuContext(row));
				}
			}
		};

		if (this.reviewMode) {
			delete columns['status'];
			delete columns['knowledge'];
			delete columns['fileSize'];
			delete columns['tags'];
		} else {
			// Column chooser + `< lg` defaults. The review queue keeps its own fixed
			// reduced set — a reviewer's columns are the task, not a preference.
			for (const key of DOCS_TABLE_COLUMN_KEYS) {
				if (!this.isColumnVisible(key)) delete columns[key];
			}
		}

		this.settings = {
			selectMode: this.selectable ? 'multi' : 'single',
			actions: false,
			mode: 'external',
			hideSubHeader: true,
			pager: { display: false },
			noDataMessage: this.getTranslation('DOCS.TABLE.NO_DATA'),
			// The column map is assembled as a plain record above (entries are
			// deleted for the reduced review-queue set); assert it at the boundary.
			columns: columns as IColumns
		};
	}

	private humanizeSize(bytes?: number): string {
		if (!bytes || bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}
}
