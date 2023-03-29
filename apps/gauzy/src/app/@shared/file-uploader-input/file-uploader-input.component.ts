import {
	Component,
	Input,
	Output,
	EventEmitter,
	AfterViewInit,
	OnInit
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { IImageAsset } from '@gauzy/contracts';
import { Store } from '../../@core/services';
import { ImageUploaderBaseComponent } from '../image-uploader/image-uploader-base.component';

@Component({
	selector: 'ngx-file-uploader-input',
	templateUrl: './file-uploader-input.component.html',
	styleUrls: ['./file-uploader-input.component.scss']
})
export class FileUploaderInputComponent extends ImageUploaderBaseComponent implements AfterViewInit, OnInit {

	public inputControl = new FormControl();
	public loading: boolean = false;

	/*
	* Getter & Setter for dynamic locale
	*/
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	* Getter & Setter for dynamic locale
	*/
	_locale: string;
	get locale(): string {
		return this._locale;
	}
	@Input() set locale(value: string) {
		this._locale = value;
	}

	/*
	* Getter & Setter for full url
	*/
	_fileUrl: string;
	get fileUrl(): string {
		return this._fileUrl;
	}
	@Input() set fileUrl(fileUrl: string) {
		console.log({ fileUrl });
		this._fileUrl = fileUrl;
	}

	@Output() uploadedImageAsset = new EventEmitter<IImageAsset>();
	@Output() uploadedImgUrl: EventEmitter<string> = new EventEmitter<string>();
	@Output() uploadedImgData: EventEmitter<any> = new EventEmitter<any>();

	constructor(
		protected readonly store: Store
	) {
		super(store)
	}

	ngOnInit(): void { }

	ngAfterViewInit(): void {
		this.uploader.onSuccessItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const image: IImageAsset = JSON.parse(response);
					this.uploadedImageAsset.emit(image);

					this.inputControl.setValue(image.fullUrl);
					this.inputControl.updateValueAndValidity();
				}
			} catch (error) {
				console.log('Error while uploaded image url', error);
			}
		};
		this.uploader.onErrorItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const error = JSON.parse(response);
					console.log(error);
				}
			} catch (error) {
				console.log('Error while uploaded image url error', error);
			}
		};
	}

	/**
	 * When input changed file URL
	 *
	 * @param event
	 */
	async inputUrlChanged() {
		try {
			const fileUrl = this.inputControl.value;
			if (fileUrl) {
				await this._setupImage(fileUrl);
			}
		} catch (error) {
			console.log('Error while retrieving image from URL', error);
		}
	}

	/**
	 * Image asset upload handler
	 */
	imageUploadHandler() {
		if (this.uploader.queue.length > 0) {
			this.uploader.queue[this.uploader.queue.length - 1].upload();
		}
	}

	// async imageUrlChanged() {
	// 	const newValue =
	// 		this.fileUrl &&
	// 		this.fileUrl.replace(this.oldValue || '', '').trim();

	// 	this.loading = true;

	// 	if (this.uploader.queue.length > 0) {
	// 		this.uploader.queue[this.uploader.queue.length - 1].upload();
	// 	} else {
	// 		await this._setupImage(newValue);

	// 		this.uploadedImgUrl.emit(this.fileUrl);
	// 		this.oldValue = this.fileUrl;
	// 	}

	// 	this.uploader.onSuccessItem = (
	// 		item: any,
	// 		response: string,
	// 		status: number
	// 	) => {
	// 		const data = JSON.parse(response);
	// 		this.fileUrl = data.url;
	// 		// const locale = this.locale;
	// 		// const width = data.width;
	// 		// const height = data.height;
	// 		// const orientation = width !== height ? (width > height ? 2 : 1) : 0;
	// 		// const url = data.url;

	// 		// const newImage = {
	// 		// 	locale,
	// 		// 	url,
	// 		// 	width,
	// 		// 	height,
	// 		// 	orientation
	// 		// };

	// 		this.loading = false;
	// 		this.uploadedImgUrl.emit(data.url);
	// 		this.uploadedImgData.emit(data);
	// 		this.oldValue = this.fileUrl;
	// 	};
	// }

	private async _setupImage(imgUrl: string) {
		try {
			const img = await this.getImageMetadata(imgUrl);
			const width = img['width'];
			const height = img['height'];
			const orientation = width !== height ? (width > height ? 2 : 1) : 0;
			const locale = this.locale;
			const url = imgUrl;

			return {
				locale,
				url,
				width,
				height,
				orientation
			};
		} catch (error) {
			return error;
		}
	}
}
