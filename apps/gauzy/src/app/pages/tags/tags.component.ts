import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { LocalDataSource } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import { Tag, Organization } from '@gauzy/models';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { first } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { TagsColorComponent } from './tags-color/tags-color.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { Subscription } from 'rxjs';

export interface SelectedTag {
	data: Tag;
	isSelected: false;
}

@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = false;
	selectedTag: SelectedTag;
	smartTableSource = new LocalDataSource();
	tag: Tag;
	form: FormGroup;
	data: SelectedTag;
	disableButton = true;
	private selectedOrganization: Organization;
	private subscribeTakingSelectedOrganziation: Subscription;
	private allTags = [];

	filterOptions = [{ property: 'all', displayName: 'All' }];
	private filterOption: any;

	@ViewChild('tagsTable') tagsTable;

	constructor(
		private dialogService: NbDialogService,
		private tagsService: TagsService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subscribeTakingSelectedOrganziation = this.store.selectedOrganization$.subscribe(
			(org) => {
				this.selectedOrganization = org;
				this.loadSettings();
			}
		);

		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	async selectTag(data) {
		if (data.isSelected) {
			this.tag = data.data;
			this.disableButton = false;
			this.tagsTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async add() {
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {}
		});
		const addData = await dialog.onClose.pipe(first()).toPromise();
		this.selectedTag = null;
		this.disableButton = true;
		if (addData) {
			this.toastrService.primary(
				this.getTranslation('TAGS_PAGE.TAGS_ADD_TAG'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.loadSettings();
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.tagsService.delete(this.tag.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('TAGS_PAGE.TAGS_DELETE_TAG'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}
	async edit() {
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {
				tag: this.tag
			}
		});

		const editData = await dialog.onClose.pipe(first()).toPromise();

		this.disableButton = true;

		if (editData) {
			this.toastrService.primary(
				this.getTranslation('TAGS_PAGE.TAGS_EDIT_TAG'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('TAGS_PAGE.TAGS_NAME'),
					type: 'custom',
					width: '20%',
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
					filter: false
				}
			}
		};
	}

	async loadSettings() {
		this.selectedTag = null;
		this.allTags = [];
		this.filterOptions = [{ property: 'all', displayName: 'All' }];
		if (this.selectedOrganization) {
			const tagsByOrgLevel = await this.tagsService.getAllTagsByOrgLevel(
				this.selectedOrganization.id,
				['organization']
			);
			const tagsByTenantLevel = await this.tagsService.getAllTagsByTenantLevel(
				this.selectedOrganization.tenantId,
				['tenant']
			);
			const orgId = this.selectedOrganization.id;
			if (tagsByOrgLevel.length) {
				const result = await this.tagsService.getTagUsageCount(orgId);
				this.allTags = result.concat(tagsByTenantLevel);
				this._generateUniqueTags(this.allTags);
				this.smartTableSource.load(this.allTags);
			} else if (tagsByTenantLevel.length) {
				this._generateUniqueTags(this.allTags);
				this.smartTableSource.load(tagsByTenantLevel);
			} else {
				this.smartTableSource.load([]);
			}
		}
	}

	ngOnDestroy() {
		this.subscribeTakingSelectedOrganziation.unsubscribe();
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
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
}
