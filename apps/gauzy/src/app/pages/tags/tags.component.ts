import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITag, IOrganization, ComponentLayoutStyleEnum, ITagType } from '@gauzy/contracts';
import { ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, TagsService, TagTypesService, ToastrService } from '@gauzy/ui-core/core';
import {
	DeleteConfirmationComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	TagsMutationComponent
} from '@gauzy/ui-core/shared';
import { TagsColorComponent } from './tags-color/tags-color.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-tags',
    templateUrl: './tags.component.html',
    styleUrls: ['./tags.component.scss'],
    standalone: false
})
export class TagsComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	smartTableSource = new LocalDataSource();
	selectedTag: ITag;
	disableButton = true;
	private allTags = [];
	filterOptions: Array<any> = [];
	/**
	 * Which entry of `filterOptions` is currently filtering the table. Selecting
	 * a type changed the table and left the rail looking untouched, so the only
	 * way to tell what you were looking at was to remember what you clicked.
	 * `''` is the "All" entry, i.e. no filter.
	 */
	selectedFilterValue: string = '';
	/** Bumped per refresh so a superseded load stops before clobbering fresher data. */
	private loadGeneration = 0;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	tags: ITag[] = [];
	tagTypes: ITagType[] = [];

	private organization: IOrganization;
	tags$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();
	private _isFiltered: boolean = false;

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly tagsService: TagsService,
		private readonly tagTypesService: TagTypesService,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.tags$
			.pipe(
				debounceTime(300),
				tap(() => (this.loading = true)),
				// Sequential on purpose. Both are async and neither was awaited, so they
				// raced: `getTagTypes()` ends by reconciling the selected filter chip
				// against `allTags`, which `getTags()` is what refreshes. When the
				// tag-types response won, the reconcile reloaded the PREVIOUS
				// organization's tags. Awaiting inside one tap orders them without
				// changing what downstream operators see (they never waited either).
				tap(() => this.loadTagsThenTypes()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.tags$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.tags = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				distinctUntilChange(),
				tap(() => this._refresh$.next(true)),
				tap(() => this.tags$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	search(e) {
		const searchText = e.target.value;
		if (searchText) {
			const searchedTags = this.allTags.filter(
				(tag) =>
					(tag.name && tag.name.toLowerCase().includes(searchText.toLowerCase())) ||
					(tag.description && tag.description.toLowerCase().includes(searchText.toLowerCase()))
			);
			this._isFiltered = true;
			this._refresh$.next(true);
			this.smartTableSource.load(searchedTags);
			this.tags$.next(true);
		} else {
			this._isFiltered = false;
			this._refresh$.next(true);
			this.tags$.next(true);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.TAGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.tags = [])),
				tap(() => this.tags$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async selectTag({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTag = isSelected ? data : null;
	}

	async add() {
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {}
		});
		const addData = await firstValueFrom(dialog.onClose);
		if (addData) {
			this.toastrService.success('TAGS_PAGE.TAGS_ADD_TAG', {
				name: addData.name
			});
			this._refresh$.next(true);
			this.tags$.next(true);
		}
	}

	async delete(selectedItem?: ITag) {
		if (selectedItem) {
			this.selectTag({
				isSelected: true,
				data: selectedItem
			});
		}

		if (this.selectedTag) {
			const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

			if (result) {
				const { id, name } = this.selectedTag;
				await firstValueFrom(this.tagsService.delete(id))
					.then(() => {
						this.toastrService.success('TAGS_PAGE.TAGS_DELETE_TAG', {
							name
						});
					})
					.finally(() => {
						this._refresh$.next(true);
						this.tags$.next(true);
					});
			}
		}
	}

	async edit(selectedItem?: ITag) {
		if (selectedItem) {
			this.selectTag({
				isSelected: true,
				data: selectedItem
			});
		}

		if (this.selectedTag) {
			const dialog = this.dialogService.open(TagsMutationComponent, {
				context: {
					tag: this.selectedTag
				}
			});

			const editData = await firstValueFrom(dialog.onClose);
			if (editData) {
				this.toastrService.success('TAGS_PAGE.TAGS_EDIT_TAG', {
					name: this.selectedTag.name
				});
				this._refresh$.next(true);
				this.tags$.next(true);
			}
		}
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TAGS'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			// The four widths are a RATIO the library hands to the `<th>`s, so they
			// have to add up to the table: 20/20/70/10 came to 120%, which is why
			// Description alone took better than half the row and the other three
			// were squeezed into what was left.
			columns: {
				name: {
					title: this.getTranslation('TAGS_PAGE.TAGS_NAME'),
					type: 'custom',
					width: '22%',
					renderComponent: TagsColorComponent,
					componentInitFunction: (instance: TagsColorComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				tagTypeName: {
					title: this.getTranslation('TAGS_PAGE.TAGS_TYPE'),
					type: 'string',
					width: '18%',
					isFilterable: false,
					// `classContent` is the library's own per-column class hook and
					// lands on the div the cell renders into. Note it is NOT `class`,
					// which the Name column used to pass: `class` is declared on the
					// library's `IColumn` (so it type-checks, which is why a dozen
					// tables in this repo still pass it) but its `Column` class never
					// reads it, so it reaches no element. What the class does is in
					// `tags.component.scss`.
					classContent: 'ga-secondary-cell',
					valuePrepareFunction: (value: string) => value || '—'
				},
				description: {
					title: this.getTranslation('TAGS_PAGE.TAGS_DESCRIPTION'),
					type: 'string',
					width: '45%',
					isFilterable: false,
					// Most tags carry no description, and a column of blank cells reads
					// as a table that failed to load rather than as one with nothing to
					// say.
					valuePrepareFunction: (value: string) => value || '—'
				},
				counter: {
					title: this.getTranslation('Counter'),
					type: 'string',
					width: '15%',
					isFilterable: false,
					// Right-aligned, tabular figures — see `tags.component.scss`.
					classHeader: 'ga-numeric-cell',
					classContent: 'ga-numeric-cell',
					valuePrepareFunction: (_: any, cell: Cell) => {
						// Two callers, two shapes: the table passes a `Cell`, the card
						// grid passes the row itself (`CardGridComponent.getValue`).
						const data = cell instanceof Cell ? cell.getRow().getData() : cell;
						const count = this.getCounter(data);
						// Six-figure usage counts are common here (1890000) and unreadable
						// without digit grouping; the grouping follows the browser locale,
						// so it reads the way the viewer expects rather than the way en-US
						// does.
						return Number.isFinite(count) ? count.toLocaleString() : '—';
					}
				}
			}
		};
	}

	/**
	 * GET tag usages counter
	 */
	getCounter = (item: any): number => {
		// Define the substring to identify counter properties
		const substring = '_counter';

		// Initialize the counter to 0
		let counter = 0;

		// Iterate through properties of the 'item' object
		for (const property in item) {
			// Check if the property includes the specified substring
			if (property.includes(substring)) {
				// Parse and add the counter value to the total counter
				counter = counter + parseInt(item[property]);
			}
		}

		// Return the total counter value
		return counter;
	};

	/**
	 * @param generation the refresh this load belongs to — see `loadTagsThenTypes()`.
	 *   A load whose generation has been superseded while its request was in flight
	 *   drops the response instead of rebuilding the rail from it. Defaults to the
	 *   current refresh, which is what a standalone call wants.
	 */
	async getTagTypes(generation: number = this.loadGeneration) {
		this.loading = true;

		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { items } = await this.tagTypesService.getTagTypes({
				tenantId,
				organizationId
			});

			// Superseded while the request was out. Two requests for the same
			// resource can settle in either order, so this response may describe the
			// organization the user has already left — and the rail it would rebuild
			// is one the newer pass has already built correctly.
			if (generation !== this.loadGeneration) {
				return;
			}

			this.tagTypes = items;

			// Assigned whole rather than pushed onto a list `getTags()` has emptied.
			// The rail is a RADIOGROUP whose tab stop is the checked option, so an
			// interval where it holds only "All" while `selectedFilterValue` still
			// names a type is one where the checked option does not exist: the
			// focused radio is re-rendered away under a keyboard user mid-request,
			// and — before `filterTabStopIndex` — nothing was left to Tab back into.
			// Building the new list here and swapping it in one statement means the
			// rail never renders a state the selection does not match.
			this.filterOptions = [
				{ value: '', displayName: 'All' },
				...this.tagTypes.map((tagType) => {
					return {
						value: tagType.id,
						displayName: tagType.type
					};
				})
			];
		} catch (error) {
			// Logged whatever its generation — a failure is worth seeing in the
			// console even once the pass that caused it has been superseded.
			console.error('Error while retrieving tag types', error);
			if (generation !== this.loadGeneration) {
				return;
			}
			this.toastrService.danger('TAGS_PAGE.TAGS_FETCH_FAILED', 'Error fetching tag types');
			// A failed fetch may be a failed ORGANIZATION SWITCH, and the types still
			// on screen would then be the previous organization's. "All" alone is the
			// honest rail, and the reconcile below moves the selection onto it.
			this.filterOptions = [{ value: '', displayName: 'All' }];
		} finally {
			// `finally` runs on the stale returns above as well, and neither of these
			// belongs to a superseded pass: the reconcile would judge the newer rail
			// against this one's `allTags`, and the spinner is the newer pass's to
			// clear when its own request comes home.
			if (generation === this.loadGeneration) {
				this.reconcileSelectedFilter();
				this.loading = false;
			}
		}
	}

	/**
	 * Drops a filter selection that no longer exists.
	 *
	 * `getTagTypes()` rebuilds `filterOptions` from the current organization's tag
	 * types, so a chip that was selected a moment ago can simply be gone — switching
	 * organization is the usual way. Left alone, the rail then highlights nothing at
	 * all, not even "All".
	 *
	 * The table needs the same treatment. `getTags()` runs BEFORE this method and skips
	 * reloading while `_isFiltered` is still set, so it will have kept the previous
	 * organization's filtered rows on screen. Reloading `allTags` — which `getTags()` has
	 * already refreshed — puts the rail and the table back in agreement.
	 */
	private reconcileSelectedFilter() {
		if (this.filterOptions.some((option) => option.value === this.selectedFilterValue)) {
			return;
		}
		this.selectedFilterValue = '';
		if (this._isFiltered) {
			this._isFiltered = false;
			this.smartTableSource.load(this.allTags);
		}
	}

	/**
	 * Loads the tags, then the tag types, in that order.
	 *
	 * Ordered because `getTagTypes()` finishes by reconciling the selected filter chip
	 * against `allTags`, which `getTags()` is what refreshes; un-awaited they raced and
	 * the reconcile could run against the previous organization's tags.
	 *
	 * GENERATIONS. A pagination, search or organization change can arrive while the
	 * first request is still in flight, so every refresh takes a number and both
	 * loads carry it. The number is checked twice: here, before the second load is
	 * started at all, and again inside each load when its own request comes home.
	 *
	 * The second check is what overlapping passes actually need. Starting a load is
	 * not the same as finishing one — two requests for the same resource can settle
	 * in either order — so a `getTagTypes()` that was current when it started can
	 * still be answered after a newer one, and without the check it would rebuild
	 * the filter rail from the organization the user has already left and then
	 * reconcile the selection against it.
	 *
	 * None of this aborts the in-flight call (these are promises, not cancellable
	 * observables): a superseded response is fetched and then dropped on arrival.
	 */
	private async loadTagsThenTypes(): Promise<void> {
		const generation = ++this.loadGeneration;
		await this.getTags(generation);
		if (generation !== this.loadGeneration) {
			return;
		}
		await this.getTagTypes(generation);
	}

	/**
	 * @param generation the refresh this load belongs to — see `loadTagsThenTypes()`.
	 *   Defaults to the current refresh, which is what a standalone call wants.
	 */
	async getTags(generation: number = this.loadGeneration) {
		this.allTags = [];

		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { items } = await this.tagsService.getTags(
				{
					tenantId,
					organizationId
				},
				['tagType']
			);

			// Superseded while the request was out, as in `getTagTypes()`: these rows
			// and the pagination they total would be the previous organization's, and
			// `allTags` is what the reconcile reads.
			if (generation !== this.loadGeneration) {
				return;
			}

			const { activePage, itemsPerPage } = this.getPagination();

			this.allTags = items;

			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (!this._isFiltered) {
				this.smartTableSource.load(this.allTags);
			} else {
				if (!this._isGridLayout) await this.smartTableSource.getElements();
			}
			this._loadDataLayoutCard();
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
		} catch (error) {
			console.error('Error while retrieving tags', error);
			if (generation !== this.loadGeneration) {
				return;
			}
			this.toastrService.danger(error);
		} finally {
			// The spinner belongs to whichever pass is current; a superseded one
			// leaves it up for the pass that replaced it.
			if (generation === this.loadGeneration) {
				this.loading = false;
			}
		}
	}

	private async _loadDataLayoutCard() {
		if (this._isGridLayout) {
			const tags = await this.smartTableSource.getElements();
			this.tags = Array.from(new Set(this.tags));
			this.tags.push(...tags);
		}
	}

	private get _isGridLayout() {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	/**
	 * Which option of the rail carries its single tab stop.
	 *
	 * A radiogroup owes the keyboard exactly one, and the CHECKED option is
	 * normally it (see `onFilterKeydown`). When nothing is checked the group still
	 * needs one, or it cannot be reached by Tab at all — the pattern's answer is
	 * the first option, which is what the `-1` branch below returns.
	 *
	 * That is not a hypothetical here: `filterOptions` is rebuilt on every refresh
	 * while `selectedFilterValue` still names the type the last list carried, and a
	 * type that has genuinely gone (an organization switch, a failed fetch) leaves
	 * the selection matching nothing until `reconcileSelectedFilter()` clears it.
	 * Tying the tab stop to the selection alone made every radio `tabindex="-1"`
	 * for those windows, with the focused one re-rendered away underneath whoever
	 * was using it.
	 */
	get filterTabStopIndex(): number {
		const checked = this.filterOptions.findIndex((option) => option.value === this.selectedFilterValue);
		return checked === -1 ? 0 : checked;
	}

	/**
	 * Arrow-key navigation for the tag-type rail.
	 *
	 * The rail is a RADIOGROUP, not a row of toggle buttons: the options are
	 * mutually exclusive, so picking one clears the last. A radiogroup is one
	 * tab stop with the arrows moving between (and selecting) the options —
	 * which is also why the template gives `tabindex="0"` to one option only
	 * (`filterTabStopIndex`). Tab therefore enters the rail on the active filter
	 * and leaves it again, instead of stepping through every tag type.
	 *
	 * Home/End go to the ends, as the pattern expects.
	 *
	 * @param event the originating keydown, whose target is the focused option
	 * @param index position of that option in `filterOptions`
	 */
	onFilterKeydown(event: KeyboardEvent, index: number) {
		const count = this.filterOptions.length;
		if (!count) {
			return;
		}
		let next: number;
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				next = (index + 1) % count;
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				next = (index - 1 + count) % count;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = count - 1;
				break;
			default:
				return;
		}
		// The rail scrolls, so the browser would page it under us on Arrow/Home/End.
		event.preventDefault();
		this.selectedFilterOption(this.filterOptions[next].value);
		// Selection and focus move together in a radiogroup. Queried off the group
		// rather than off a sibling list, so the lookup survives whatever wrapper
		// `nb-list` renders around the items.
		const option = event.currentTarget as HTMLElement;
		const options = option.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
		options?.item(next)?.focus();
	}

	/**
	 * Select Filter
	 *
	 * @param value
	 * @returns
	 */
	selectedFilterOption(value: string) {
		this.selectedFilterValue = value;
		if (value === '') {
			this._isFiltered = false;
			this._refresh$.next(true);
			this.tags$.next(true);
			return;
		}
		if (value) {
			const tags = this.allTags.filter((tag) => tag.tagTypeId === value);
			this._isFiltered = true;
			this._refresh$.next(true);
			this.smartTableSource.load(tags);
			this.tags$.next(true);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	private clearItem() {
		this.selectTag({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
