import { Component, OnInit, OnDestroy } from '@angular/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { LocalDataSource } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { first } from 'rxjs/operators';

export interface SelectedTag {
	data: Tag;
	isSelected: boolean;
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
		this.loadSettings();
	}

	selectTag(data: SelectedTag) {
		if (data.isSelected) {
			this.tag = data.data;
		}
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
	}
	async edit() {}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: 'Full Name',
					type: 'string'
				},
				description: {
					title: 'Descpription',
					type: 'string'
				},
				color: {
					title: 'Color',
					type: 'string'
				}
			}
		};
	}

	async loadSettings() {
		const { items } = await this.tagsService.getAllTags();
		this.smartTableSource.load(items);
	}

	ngOnDestroy() {}
}
