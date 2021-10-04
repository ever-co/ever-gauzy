import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
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
	form: FormGroup;
	disableButton = true;
	private allTags = [];
	filterOptions = [
		{ property: 'all', displayName: 'All' }
	];
	private filterOption: any;
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
		console.log(this.selectedTag);
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
		this.getTags();
		this.clearItem();
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
					type: 'string',
					filter: false
				},
				counter: {
					title: this.getTranslation('Counter'),
					type: 'string',
					width: '25%',
					filter: false
				}
			}
		};
	}

	async getTags() {
		if (!this.organization) {
			return;
		}

		this.allTags = [];
		this.filterOptions = [
			{ property: 'all', displayName: 'All' }
		];

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.tagsService.getAllTags(
			['organization'],
			{ tenantId, organizationId }
		);
	
		this.allTags = items;
		
		// this._generateUniqueTags(this.allTags);
		this.tags = this.allTags;
		this.smartTableSource.load(this.allTags);

		this.loading = false;
	}

	ngOnDestroy() {}

	selectedFilterOption(value) {
		this.filterOption = value;
		if (value === 'all') {
			this.getTags();
			this.smartTableSource.load(this.allTags);
			return;
		}
		if (this.filterOption) {
			const filterTags = this.allTags.filter(
				(tag) => tag[value] && tag[value].length
			);
			this.smartTableSource.load(filterTags);
		}
	}

	// private _generateUniqueTags(tags: any[]) {
	// 	tags.forEach((tag) => {
	// 		for (const property in tag) {
	// 			if (
	// 				Array.isArray(tag[property]) &&
	// 				tag[property].length &&
	// 				!this.filterOptions.find(
	// 					(option) => option.property === property
	// 				)
	// 			) {
	// 				this.filterOptions.push({
	// 					property,
	// 					displayName: splitCamelCase(property)
	// 				});
	// 			}
	// 		}
	// 	});
	// }

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
}
