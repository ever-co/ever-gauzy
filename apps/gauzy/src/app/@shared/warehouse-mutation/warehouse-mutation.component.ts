import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { ITag } from '@gauzy/contracts';

@Component({
	selector: 'ga-warehouse-mutation',
	templateUrl: './warehouse-mutation.component.html',
	styleUrls: ['./warehouse-mutation.component.scss']
})
export class WarehouseMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	tags: ITag[] = [];

	public color = '';
	public name = '';
	constructor(
		public dialogRef: NbDialogRef<WarehouseMutationComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {}

	onSaveRequest() {}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
}
