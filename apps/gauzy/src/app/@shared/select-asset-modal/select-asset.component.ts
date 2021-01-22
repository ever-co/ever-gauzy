import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { ImageAssetComponent } from './img-asset/img-asset.component';
import { IImageAsset } from '@gauzy/models';
import { Subject } from 'rxjs';

@Component({
	selector: 'ngx-select-asset',
	templateUrl: './select-asset.component.html',
	styleUrls: ['./select-asset.component.scss']
})
export class SelectAssetComponent
	extends TranslationBaseComponent
	implements OnChanges {
	selectedImage: ImageAssetComponent;
	@Input() gallery: IImageAsset[] = [];
	@Input() newImageUploadedEvent: Subject<any>;

	constructor(
		public dialogRef: NbDialogRef<any>,
		readonly translationService: TranslateService
	) {
		super(translationService);
	}
	ngOnChanges(changes: SimpleChanges): void {}

	onSelectImage($event) {
		this.selectedImage = $event;
	}

	onImageUploaded($event) {
		this.newImageUploadedEvent.next($event);
	}
}
