import {
	Component,
	Input,
	Output,
	EventEmitter,
	ViewChild,
	ElementRef,
	AfterViewInit,
	OnInit
} from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';

@Component({
	selector: 'ngx-file-uploader-input',
	templateUrl: './file-uploader-input.component.html',
	styleUrls: ['./file-uploader-input.component.scss']
})
export class FileUploaderInputComponent implements AfterViewInit, OnInit {

	user: IUser;
	uploader: FileUploader;
	loading: boolean = false;

	/*
	* Getter & Setter for dynamic image upload folder
	*/
	_folder: string = 'profile_pictures';
	get folder(): string {
		return this._folder;
	}
	@Input() set folder(value: string) {
		this._folder = value;
	}

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
	* Getter & Setter for dynamic custom class
	*/
	_customClass: string;
	get customClass(): string {
		return this._customClass;
	}
	@Input() set customClass(value: string) {
		this._customClass = value;
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
	* Getter & Setter for dynamic name
	*/
	_name: string;
	get name(): string {
		return this._name;
	}
	@Input() set name(value: string) {
		this._name = value;
	}

	/*
	* Getter & Setter for full url
	*/
	_fileUrl: string;
	get fileUrl(): string {
		return this._fileUrl;
	}
	@Input() set fileUrl(value: string) {
		this._fileUrl = value;
	}

	@Output() uploadedImgUrl: EventEmitter<string> = new EventEmitter<string>();
	@Output() uploadedImgData: EventEmitter<any> = new EventEmitter<any>();

	@ViewChild('fileInput') fileInput: ElementRef;

	private oldValue: string;

	constructor() { }

	ngOnInit(): void {
		this._uploaderConfig();
	}

	ngAfterViewInit(): void {
	}

	async imageUrlChanged() {
		const newValue =
			this.fileUrl &&
			this.fileUrl.replace(this.oldValue || '', '').trim();

		this.loading = true;

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

			this.loading = false;
			this.uploadedImgUrl.emit(data.url);
			this.uploadedImgData.emit(data);
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

	private async _setupImage(imgUrl: string) {
		try {
			const img = await this.getImageMetadata(imgUrl);
			const width = img['width'];
			const height = img['height'];
			const orientation = width !== height ? (width > height ? 2 : 1) : 0;
			const locale = this.locale;
			const url = imgUrl;

			console.log({
				locale,
				url,
				width,
				height,
				orientation
			});
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

	/**
	 * Get image metadata using by Image URL
	 *
	 * @param url
	 * @returns
	 */
	getImageMetadata(url: string) {
		try {
			return new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = (error: any) => reject(false);
				img.src = url;
			});
		} catch (error) {
			console.log('Error while retrieving image metadata', error);
		}
	}
}
