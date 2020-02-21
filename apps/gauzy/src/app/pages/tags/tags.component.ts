import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TagsMutationComponent } from '../../@shared/tags/tags-mutation.component'
import { first } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
// import { TagsService } from '../../@core/services/tags.service';

@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	private _ngDEstroy$ = new Subject<void>()
	
	

	constructor(
		private translate: TranslateService,
		private dialogService: NbDialogService,
		// private tagsService: TagsService,
	) {}
	loading = false;
	
	async ngOnInit() {
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
					 title: "Color",
					 type: 'string'
				}
			}
		};


	}
	async add(){
		  
		this.dialogService.open(TagsMutationComponent);

	
	}
	async delete(){

	}
	async edit(){

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
