import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Cell, IColumns, LocalDataSource, Settings } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CategoryChipsComponent } from './cells/category-chips.component';
import { KnowledgeBadgeComponent } from './cells/knowledge-badge.component';
import { NameCellComponent } from './cells/name-cell.component';
import { SourceBadgeComponent } from './cells/source-badge.component';
import { StatusBadgeComponent } from './cells/status-badge.component';
import { TagChipsComponent } from './cells/tag-chips.component';

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
export class DocsTableComponent extends TranslationBaseComponent implements OnInit, OnChanges {
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

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this.buildSettings();
		this._applyTranslationOnSmartTable();
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

	onUserRowSelect(event: { data?: IDocument | null; selected?: IDocument[] }): void {
		if (event?.selected) {
			this.selectionChanged.emit(event.selected.map((row) => row.id as ID));
		}
		if (event?.data) {
			// FOLDER rows drill in; everything else opens the detail panel.
			if (event.data.kind === DocumentKindEnum.FOLDER) {
				this.folderOpened.emit(event.data);
			} else {
				this.rowClicked.emit(event.data);
			}
		}
	}

	/**
	 * Per-kind default open on double click (`01-ux-spec.md` §4.1) — folder drill,
	 * page editor, file preview. `angular2-smart-table` exposes no dblclick output,
	 * so the row is resolved from the DOM position of the clicked `<tr>` within the
	 * rendered body; `this.rows` is exactly what was handed to the data source, in
	 * order, so the index maps 1:1. Anything unresolvable is ignored (never guessed).
	 */
	onRowDoubleClick(event: MouseEvent): void {
		const row = (event.target as HTMLElement)?.closest?.('tr');
		const body = row?.parentElement;
		if (!row || !body) return;
		const index = Array.prototype.indexOf.call(body.children, row);
		const data = index >= 0 ? this.rows?.[index] : undefined;
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
	}

	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildSettings());
	}

	private buildSettings(): void {
		const columns: Record<string, unknown> = {
			name: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.NAME'),
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
				title: this.getTranslation('DOCS.TABLE.COLUMNS.CATEGORIES'),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: CategoryChipsComponent,
				componentInitFunction: (instance: CategoryChipsComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			tags: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.TAGS'),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: TagChipsComponent,
				componentInitFunction: (instance: TagChipsComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			status: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.STATUS'),
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
				title: this.getTranslation('DOCS.TABLE.COLUMNS.KNOWLEDGE'),
				type: 'custom',
				isSortable: false,
				isFilterable: false,
				renderComponent: KnowledgeBadgeComponent,
				componentInitFunction: (instance: KnowledgeBadgeComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			source: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.SOURCE'),
				type: 'custom',
				isSortable: true,
				isFilterable: false,
				renderComponent: SourceBadgeComponent,
				componentInitFunction: (instance: SourceBadgeComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
			},
			fileSize: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.SIZE'),
				type: 'text',
				isSortable: true,
				isFilterable: false,
				valuePrepareFunction: (value: number) => this.humanizeSize(value)
			},
			updatedAt: {
				title: this.getTranslation('DOCS.TABLE.COLUMNS.UPDATED'),
				type: 'text',
				isSortable: true,
				isFilterable: false,
				valuePrepareFunction: (value: string | Date) => (value ? new Date(value).toLocaleString() : '')
			}
		};

		if (this.reviewMode) {
			delete columns['status'];
			delete columns['knowledge'];
			delete columns['fileSize'];
			delete columns['tags'];
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
