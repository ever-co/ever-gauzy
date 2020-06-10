import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { LocalDataSource } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import { Tag, Organization } from '@gauzy/models';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { first, takeUntil } from 'rxjs/operators';
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
				}
			}
		};
	}

	async loadSettings() {
		this.selectedTag = null;
		const { items } = await this.tagsService.getAllTags(['organization']);

		const filteredItems = items.filter(
			(data) => data.organization.id === this.selectedOrganization.id
		);

		this.smartTableSource.load(filteredItems);
	}

	ngOnDestroy() {
		this.subscribeTakingSelectedOrganziation.unsubscribe();
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
