import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IImageAsset } from '@gauzy/contracts';

@Component({
	selector: 'ngx-img-asset',
	templateUrl: './img-asset.component.html',
	styleUrls: ['./img-asset.component.scss']
})
export class ImageAssetComponent implements OnInit {
	@Input()
	imageAsset: IImageAsset;

	@Input()
	selectedImage: IImageAsset;

	@Output() imageClicked = new EventEmitter<any>();

	ngOnInit(): void {}

	get selected() {
		if (!this.imageAsset || !this.selectedImage) return;

		return this.imageAsset.url == this.selectedImage.url;
	}

	onImageClick($event) {
		this.imageClicked.emit(this.imageAsset);
	}
}
