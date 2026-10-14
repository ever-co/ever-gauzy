import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IImageAsset } from '@gauzy/contracts';

@Component({
    selector: 'ngx-img-preview',
    templateUrl: './img-preview.component.html',
    styleUrls: ['./img-preview.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ImagePreviewComponent {
	@Input()
	selectedImage: IImageAsset;
}
