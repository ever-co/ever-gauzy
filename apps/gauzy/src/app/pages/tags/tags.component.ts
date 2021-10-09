import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ITag,
	IOrganization,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { distinctUntilChange, splitCamelCase } from '@gauzy/common-angular';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { TagsColorComponent } from './tags-color/tags-color.component';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { Store, TagsService, ToastrService } from '../../@core/services';
import { ComponentEnum } from '../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

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

	private organization: IOrganization;
	tags$: Subject<any> = new Subject();

	tagsTable: Ng2SmartTableComponent;
	@ViewChild('tagsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.tagsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly tagsService: TagsService,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
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
				tap(() => this.loading = true),
				tap(() => this.getTags()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => this.organization = organization),
				distinctUntilChange(),
				tap(() => this.tags$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	search(e) {
		const searchText = e.target.value;
		if (searchText) {
			const searchedTags = this.allTags.filter(
				(tag) =>
					(tag.name &&
						tag.name
							.toLowerCase()
							.includes(searchText.toLowerCase())) ||
					(tag.description &&
						tag.description
							.toLowerCase()
							.includes(searchText.toLowerCase()))
			);
			this.smartTableSource.load(searchedTags);
		} else {
			this.smartTableSource.load(this.allTags);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.TAGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
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
		const addData = await dialog.onClose.pipe(first()).toPromise();
		if (addData) {
			this.toastrService.success('TAGS_PAGE.TAGS_ADD_TAG', {
				name: addData.name
			});
		}
		this.tags$.next();
	}

	async delete(selectedItem?: ITag) {
		if (selectedItem) {
			this.selectTag({
				isSelected: true,
				data: selectedItem
			});
		}

		if (this.selectedTag) {
			const result = await this.dialogService
				.open(DeleteConfirmationComponent)
				.onClose.pipe(first())
				.toPromise();

			if (result) {
				const { id, name } = this.selectedTag; 
				await this.tagsService.delete(id).then(() => {
					this.toastrService.success('TAGS_PAGE.TAGS_DELETE_TAG', {
						name
					});
				})
				.finally(() => {
					this.tags$.next();
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
	
			const editData = await dialog.onClose.pipe(first()).toPromise();
			if (editData) {
				this.toastrService.success('TAGS_PAGE.TAGS_EDIT_TAG', {
					name: this.selectedTag.name
				});
			}
			this.tags$.next();
		}
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('TAGS_PAGE.TAGS_NAME'),
					type: 'custom',
					width: '30%',
					class: 'text-center',
					renderComponent: TagsColorComponent
				},
				description: {
					title: this.getTranslation('TAGS_PAGE.TAGS_DESCRIPTION'),
					type: 'string'
				},
				counter: {
					title: this.getTranslation('Counter'),
					type: 'string',
					width: '25%',
					filter: false,
					valuePrepareFunction: (value, item) => {
						return this.getCounter(item);
					}
				}
			}
		};
	}

	/**
	 * GET tag usages counter
	 */
	getCounter = (item): number => {
		const substring = "_counter";
		let counter = 0; 
		for (const property in item) {
			if (property.includes(substring)) {
				counter = counter + parseInt(item[property]);
			}
		}
		return counter;
	}

	async getTags() {
		this.allTags = [];
		this.filterOptions = [
			{ property: 'all', displayName: 'All' }
		];

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.tagsService.getTags(
			['organization'],
			{ tenantId, organizationId }
		);
	
		this.allTags = items;
		this.tags = this.allTags;
		
		this._generateUniqueTags(this.allTags);
		this.smartTableSource.load(this.allTags);

		this.loading = false;
	}

	/**
	 * Select Filter 
	 * 
	 * @param value 
	 * @returns 
	 */
	selectedFilterOption(value: string) {
		if (value === 'all') {
			this.tags$.next();
			this.smartTableSource.load(this.allTags);
			return;
		}
		if (value) {
			const tags = this.allTags.filter(
				(tag) => tag[value] && parseInt(tag[value]) > 0
			);
			this.smartTableSource.load(tags);
		}
	}

	/**
	 * Generate Unique Tags
	 * 
	 * @param tags 
	 */
	private _generateUniqueTags(tags: any[]) {
		tags.forEach((tag) => {
			for (const property in tag) {
				const substring = "_counter";
				if (
					property.includes(substring) &&
					parseInt(tag[property]) > 0
				) {
					const options = this.filterOptions.find(
						(option) => option.property === property
					);
					if (!options) {
						this.filterOptions.push({
							property,
							displayName: splitCamelCase(property.replace(substring, ''))
						});
					}
				}
			}
		});
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
	 * Table on changed source event
	 */
	private onChangedSource() {
		this.tagsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
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
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	private deselectAll() {
		if (this.tagsTable && this.tagsTable.grid) {
			this.tagsTable.grid.dataSet['willSelect'] = 'false';
			this.tagsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
