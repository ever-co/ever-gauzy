import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IImageAsset, IProductCategoryTranslated } from '@gauzy/models';

@Component({
	selector: 'ngx-img-asset',
	templateUrl: './img-asset.component.html',
	styleUrls: ['./img-asset.component.scss']
})
export class ImageAssetComponent implements OnInit {
	@Input()
	imageAsset: IImageAsset;

	@Output() imageClicked = new EventEmitter<any>();

	onImageClick($event) {}

	ngOnInit(): void {
		console.log('image asset', this.imageAsset);
	}
}
