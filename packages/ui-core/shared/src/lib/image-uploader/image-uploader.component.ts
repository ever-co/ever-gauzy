import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FileItem, FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { filter, tap } from 'rxjs/operators';
import { IImageAsset, IOrganization, IUser } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-image-uploader',
	template: `
		<input
			type="file"
			accept="image/*"
			(change)="imageUploadHandler()"
			(mouseenter)="changeHoverState.emit(true)"
			(mouseleave)="changeHoverState.emit(false)"
			ng2FileSelect
			[ngStyle]="styles"
			[uploader]="uploader"
		/>
	`,
	styleUrls: ['./image-uploader.component.scss']
})
export class ImageUploaderComponent implements AfterViewInit, OnInit {
	public organization: IOrganization;
	public user: IUser;
	public uploader: FileUploader;
	/*
	 * Getter & Setter for dynamic file uploader style element
	 */
	private _styles: Object = {
		width: '100%',
		opacity: '0',
		position: 'absolute',
		zIndex: 3,
		cursor: 'pointer'
	};
	get styles(): Object {
		return this._styles;
	}
	@Input() set styles(styles: Object) {
		this._styles = styles;
	}

	/*
	 * Getter & Setter for dynamic image upload folder
	 */
	private _folder: string = 'profile_pictures';
	get folder(): string {
		return this._folder;
	}
	@Input() set folder(value: string) {
		this._folder = value;
	}

	@Output() changeHoverState = new EventEmitter<boolean>();
	@Output() uploadedImageAsset = new EventEmitter<IImageAsset>();
	@Output() uploadImageAssetError = new EventEmitter<any>();

	constructor(private readonly store: Store) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this._loadUploaderSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		if (!this.uploader) {
			return;
		}
		this.uploader.onAfterAddingFile = (file) => {
			file.withCredentials = false;
		};
		this.uploader.onSuccessItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const image: IImageAsset = JSON.parse(response);
					this.uploadedImageAsset.emit(image);
				}
			} catch (error) {
				console.log('Error while uploaded image url', error);
			}
		};
		this.uploader.onErrorItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const error = JSON.parse(response);
					this.uploadImageAssetError.emit(error);
				}
			} catch (error) {
				console.log('Error while uploaded image url error', error);
			}
		};
	}

	/**
	 * Image asset upload handler
	 */
	imageUploadHandler() {
		if (this.uploader.queue.length > 0) {
			this.uploader.queue[this.uploader.queue.length - 1].upload();
		}
	}

	/**
	 * Load settings for the file uploader, including headers and additional form data.
	 *
	 * @returns void
	 */
	private _loadUploaderSettings() {
		if (!this.user) {
			return;
		}
		const token = this.store.token;
		const tenantId = this.user.tenantId;

		const headers: Array<{ name: string; value: string }> = [];
		headers.push({ name: 'Authorization', value: `Bearer ${token}` });
		headers.push({ name: 'Tenant-Id', value: tenantId });

		if (!!this.organization) {
			headers.push({ name: 'Organization-Id', value: `${this.organization.id}` });
		}

		const uploaderOptions: FileUploaderOptions = {
			url: environment.API_BASE_URL + `${API_PREFIX}/image-assets/upload/${this.folder}`,
			method: 'POST', // XHR request method
			autoUpload: true, // Upload files automatically upon addition to upload queue
			isHTML5: true, // Use xhrTransport in favor of iframeTransport
			removeAfterUpload: true, // Calculate progress independently for each uploaded file
			headers: headers // XHR request headers
		};
		this.uploader = new FileUploader(uploaderOptions);

		// Adding additional form data
		this.uploader.onBuildItemForm = (fileItem: FileItem, form) => {
			if (!!this.store.user.tenantId) {
				form.append('tenantId', tenantId);
			}

			if (!!this.organization) {
				form.append('organizationId', this.organization.id);
			}
		};
	}
}
