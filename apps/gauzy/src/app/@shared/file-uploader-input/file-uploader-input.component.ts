import {
	Component,
	Input,
	Output,
	EventEmitter,
	ViewChild
} from '@angular/core';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { NgModel } from '@angular/forms';

@Component({
	selector: 'ngx-file-uploader-input',
	templateUrl: './file-uploader-input.component.html',
	styleUrls: ['./file-uploader-input.component.scss']
})
export class FileUploaderInputComponent {
	@ViewChild('shownInput', { static: true })
	shownInput: NgModel;

	@Input()
	placeholder: string;
	@Input()
	name: string;
	@Input()
	fileUrl: string;
	@Input()
	customClass: string;
	@Input()
	locale: string;

	@Output()
	uploadedImgUrl: EventEmitter<string> = new EventEmitter<string>();
	uploader: FileUploader;

	private oldValue: string;

	constructor() {}

	ngOnInit(): void {
		this._uploaderConfig();
	}

	async imageUrlChanged() {
		const newValue =
			this.fileUrl &&
			this.fileUrl.replace(this.oldValue || '', '').trim();

		if (this.uploader.queue.length > 0) {
			this.uploader.queue[this.uploader.queue.length - 1].upload();
		} else {
			await this._setupImage(newValue);

			this.uploadedImgUrl.emit(this.fileUrl);
			this.oldValue = this.fileUrl;
		}

		this.uploader.onSuccessItem = (
			item: any,
			response: string,
			status: number
		) => {
			const data = JSON.parse(response);
			this.fileUrl = data.url;
			// const locale = this.locale;
			// const width = data.width;
			// const height = data.height;
			// const orientation = width !== height ? (width > height ? 2 : 1) : 0;
			// const url = data.url;

			// const newImage = {
			// 	locale,
			// 	url,
			// 	width,
			// 	height,
			// 	orientation
			// };

			this.uploadedImgUrl.emit(data.url);
			this.oldValue = this.fileUrl;
		};
	}

	private _uploaderConfig() {
		const uploaderOptions: FileUploaderOptions = {
			url: 'https://api.cloudinary.com/v1_1/evereq/upload',

			isHTML5: true,
			removeAfterUpload: true,
			headers: [
				{
					name: 'X-Requested-With',
					value: 'XMLHttpRequest'
				}
			]
		};
		this.uploader = new FileUploader(uploaderOptions);

		this.uploader.onBuildItemForm = (
			fileItem: any,
			form: FormData
		): any => {
			form.append('upload_preset', 'everbie-products-images');

			let tags = 'myphotoalbum';

			if (this.name) {
				form.append('context', `photo=${this.name}`);
				tags = `myphotoalbum,${this.name}`;
			}

			form.append('folder', 'angular_sample');
			form.append('tags', tags);
			form.append('file', fileItem);

			fileItem.withCredentials = false;

			return { fileItem, form };
		};
	}

	private async _setupImage(imgUrl) {
		try {
			const img = await this._getImageMeta(imgUrl);
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

	private async _getImageMeta(url) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = (err) => reject(false);
			img.src = url;
		});
	}
}
