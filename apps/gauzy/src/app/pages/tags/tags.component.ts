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
				tap(() => this.getTags()),
				tap(() => this.getTagTypes()),
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
			columns: {
				name: {
					title: this.getTranslation('TAGS_PAGE.TAGS_NAME'),
					type: 'custom',
					width: '20%',
					class: 'text-center',
					renderComponent: TagsColorComponent,
					componentInitFunction: (instance: TagsColorComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				tagTypeName: {
					title: this.getTranslation('TAGS_PAGE.TAGS_TYPE'),
					type: 'string',
					width: '20%',
					isFilterable: false
				},
				description: {
					title: this.getTranslation('TAGS_PAGE.TAGS_DESCRIPTION'),
					type: 'string',
					width: '70%',
					isFilterable: false
				},
				counter: {
					title: this.getTranslation('Counter'),
					type: 'string',
					width: '10%',
					isFilterable: false,
					valuePrepareFunction: (_: any, cell: Cell) => {
						if (cell instanceof Cell) {
							const data = cell.getRow().getData();
							return this.getCounter(data);
						}
						return this.getCounter(cell);
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

	async getTagTypes() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			const { items } = await this.tagTypesService.getTagTypes({
				tenantId,
				organizationId
			});

			this.tagTypes = items;

			this.filterOptions.push(
				...this.tagTypes.map((tagType) => {
					return {
						value: tagType.id,
						displayName: tagType.type
					};
				})
			);
			this.loading = false;
		} catch (error) {
			this.loading = false;
			this.toastrService.danger('TAGS_PAGE.TAGS_FETCH_FAILED', 'Error fetching tag types');
		}
	}

	async getTags() {
		this.allTags = [];
		this.filterOptions = [{ value: '', displayName: 'All' }];

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.tagsService.getTags(
			{
				tenantId,
				organizationId
			},
			['tagType']
		);

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
		this.loading = false;
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
	 * Select Filter
	 *
	 * @param value
	 * @returns
	 */
	selectedFilterOption(value: string) {
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
