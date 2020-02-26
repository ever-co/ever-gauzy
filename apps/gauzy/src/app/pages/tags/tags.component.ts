import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { Store } from '../../@core/services/store.service';
import { LocalDataSource } from 'ng2-smart-table';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { first } from 'rxjs/operators';


export interface SelectedTag{
	name: string;
	color: string;
	description: string;
}



@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = false;
	private _ngDestroy$ = new Subject<void>();
	selectedTag: SelectedTag;
	smartTableSource = new LocalDataSource();
	tag: Tag;

	constructor(
		private translate: TranslateService,
		private dialogService: NbDialogService,
		private store: Store,
		private tagsService: TagsService
	) {}

	ngOnInit() {
		
		this.loadSmartTable();
	
		this.loadSettings();
		
	}
	
	async add() {
		this.dialogService.open(TagsMutationComponent);
	}
	async delete() {}
	async edit() {}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
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
	async loadSettings(){
	
		const {items} = await this.tagsService.getAllTags();
		console.warn(items);
		this.smartTableSource.load(items);
		
			
	 }


	getTranslation(prefix: string) {
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
	}
	ngOnDestroy() {}
}
