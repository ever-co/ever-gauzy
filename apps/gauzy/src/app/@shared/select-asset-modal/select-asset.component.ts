import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { ImageAssetComponent } from './img-asset/img-asset.component';

@Component({
	selector: 'ngx-select-asset',
	templateUrl: './select-asset.component.html',
	styleUrls: ['./select-asset.component.scss']
})
export class SelectAssetComponent extends TranslationBaseComponent {
	selectedImage: ImageAssetComponent;

	testImages = [
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		},
		{
			name: 'Walcing cat',
			url: 'https://afostats.imagead.net/uploads/afo/no_img.png',
			width: 400,
			height: 400,
			isFeatured: false
		}
	];

	constructor(
		public dialogRef: NbDialogRef<any>,
		readonly translationService: TranslateService
	) {
		super(translationService);
	}

	onSelectImage($event) {
		this.selectedImage = $event;
	}
}
