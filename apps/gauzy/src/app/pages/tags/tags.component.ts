import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import {
	ITag,
	IOrganization,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { filter, first, tap } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { TagsColorComponent } from './tags-color/tags-color.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { RouterEvent, NavigationEnd, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	selectedTag: ITag;
	smartTableSource = new LocalDataSource();
	tag: ITag;
	form: FormGroup;
	disableButton = true;
	private selectedOrganization: IOrganization;
	private allTags = [];
	filterOptions = [{ property: 'all', displayName: 'All' }];
	private filterOption: any;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	tagsData: ITag[];

	tagsTable: Ng2SmartTableComponent;
	@ViewChild('tagsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.tagsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private dialogService: NbDialogService,
		private tagsService: TagsService,
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				this.selectedOrganization = org;
				this.loadSettings();
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async selectTag({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.tag = isSelected ? data : null;
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
		this.loadSettings();
		this.clearItem();
	}

	async delete(selectedItem?: ITag) {
		if (selectedItem) {
			this.selectTag({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.tagsService.delete(this.tag.id);
			this.loadSettings();
			this.toastrService.success('TAGS_PAGE.TAGS_DELETE_TAG', {
				name: this.tag.name
			});
		}
		this.clearItem();
	}
	async edit(selectedItem?: ITag) {
		if (selectedItem) {
			this.selectTag({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {
				tag: this.tag
			}
		});

		const editData = await dialog.onClose.pipe(first()).toPromise();
		if (editData) {
			this.toastrService.success('TAGS_PAGE.TAGS_EDIT_TAG', {
				name: this.tag.name
			});
		}
		this.loadSettings();
		this.clearItem();
	}

	async loadSmartTable() {
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

	async loadSettings() {
		this.loading = true;
		this.selectedTag = null;
		this.allTags = [];
		this.filterOptions = [{ property: 'all', displayName: 'All' }];
		if (this.selectedOrganization) {
			const { id: organizationId, tenantId } = this.selectedOrganization;
			const tagsByOrgLevel = await this.tagsService.getAllTagsByOrgLevel(
				{ organizationId, tenantId },
				['organization']
			);
			const tagsByTenantLevel = await this.tagsService.getAllTagsByTenantLevel(
				{ tenantId },
				['tenant']
			);
			if (tagsByOrgLevel.length) {
				const result = await this.tagsService.getTagUsageCount(
					organizationId
				);
				this.allTags = result.concat(tagsByTenantLevel);
				this.allTags.map((t) => !t.counter && (t.counter = 0));
				this._generateUniqueTags(this.allTags);
				this.tagsData = this.allTags;
				this.smartTableSource.load(this.allTags);
			} else if (tagsByTenantLevel.length) {
				this._generateUniqueTags(this.allTags);
				this.tagsData = tagsByTenantLevel;
				this.smartTableSource.load(tagsByTenantLevel);
			} else {
				this.tagsData = [];
				this.smartTableSource.load([]);
			}
		}
		this.loading = false;
	}

	ngOnDestroy() {}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	selectedFilterOption(value) {
		this.filterOption = value;
		if (value === 'all') {
			this.loadSettings();
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

	private _generateUniqueTags(tags: any[]) {
		tags.forEach((tag) => {
			for (const property in tag) {
				if (
					Array.isArray(tag[property]) &&
					tag[property].length &&
					!this.filterOptions.find(
						(option) => option.property === property
					)
				) {
					this.filterOptions.push({
						property,
						displayName: this._splitCamelCase(property)
					});
				}
			}
		});
	}

	private _splitCamelCase(word: string): string {
		let output: string[], i: number, l: number;
		const capRe = /[A-Z]/;
		if (typeof word !== 'string') {
			throw new Error('The "word" parameter must be a string.');
		}
		output = [];
		for (i = 0, l = word.length; i < l; i++) {
			if (i === 0) {
				output.push(word[i].toUpperCase());
			} else {
				if (i > 0 && capRe.test(word[i])) {
					output.push(' ');
				}
				output.push(word[i]);
			}
		}
		return output.join('');
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
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
	clearItem() {
		this.selectTag({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.tagsTable && this.tagsTable.grid) {
			this.tagsTable.grid.dataSet['willSelect'] = 'false';
			this.tagsTable.grid.dataSet.deselectAll();
		}
	}
}
