import { Component, OnInit, OnDestroy } from '@angular/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { first } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { TagsColorComponent } from './tags-color/tags-color.component';

export interface SelectedTag {
	data: Tag;
	isSelected: false;
}

@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = false;
	selectedTag: SelectedTag;
	smartTableSource = new LocalDataSource();
	tag: Tag;
	form: FormGroup;
	data: SelectedTag;
	disableButton = true;

	constructor(
		private dialogService: NbDialogService,
		private tagsService: TagsService
	) {}

	ngOnInit() {
		this.loadSmartTable();
		this.loadSettings();
	}

	async add() {
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {}
		});

		await dialog.onClose.pipe(first()).toPromise();
		this.selectedTag = null;
		this.disableButton = true;
		this.loadSettings();
	}

	async selectTag(data) {
		if (data.isSelected) {
			this.tag = data.data;
			this.disableButton = false;
		} else {
			this.disableButton = true;
		}
		console.log(data);
	}
	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.tagsService.delete(this.tag.id);
			this.loadSettings();
		}
		this.disableButton = true;
	}
	async edit() {
		const dialog = this.dialogService.open(TagsMutationComponent, {
			context: {
				tag: this.tag
			}
		});

		await dialog.onClose.pipe(first()).toPromise();

		this.disableButton = true;
		this.loadSettings();
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: 'Name',
					type: 'string'
				},
				description: {
					title: 'Description',
					type: 'string'
				},
				color: {
					title: 'Color',
					type: 'custom',
					class: 'text-center',
					renderComponent: TagsColorComponent
				}
			}
		};
	}

	async loadSettings() {
		this.selectedTag = null;
		const { items } = await this.tagsService.getAllTags();
		this.smartTableSource.load(items);
	}

	ngOnDestroy() {}
}
