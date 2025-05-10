import { Component, Input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FileItem, FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { Subject } from 'rxjs/internal/Subject';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, IUser } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    template: '',
    standalone: false
})
export class ImageUploaderBaseComponent {
	public organization: IOrganization;
	public user: IUser;
	public uploader: FileUploader;
	protected subject$: Subject<boolean> = new Subject();

	/*
	 * Getter & Setter for dynamic image upload folder
	 */
	_folder: string = 'profile_pictures';
	get folder(): string {
		return this._folder;
	}
	@Input() set folder(value: string) {
		this._folder = value;
		this.setUploaderConfigurationOptions();
	}

	constructor(protected readonly store: Store) {
		this.onInit();
	}

	onInit() {
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
				tap(() => this.setUploaderConfigurationOptions()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Set file uploader configuration options
	 */
	setUploaderConfigurationOptions() {
		if (!this.user) {
			return;
		}
		const { token } = this.store;
		const { tenantId } = this.user;

		const headers: Array<{ name: string; value: string }> = [];
		headers.push({ name: 'Authorization', value: `Bearer ${token}` });
		headers.push({ name: 'Tenant-Id', value: tenantId });

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

	/**
	 * Get image metadata using by Image URL
	 *
	 * @param url
	 * @returns
	 */
	protected async getImageMetadata(url: string) {
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
