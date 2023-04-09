import { Component, Input } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { Subject } from 'rxjs/internal/Subject';
import { filter, tap } from 'rxjs/operators';
import { API_PREFIX } from '../../@core/constants';
import { Store } from './../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
    template: ''
})
export class ImageUploaderBaseComponent {

    user: IUser;
    uploader: FileUploader;
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

    constructor(
        protected readonly store: Store,
    ) {
        this.onInit();
    }

    onInit() {
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

        const headers: Array<{ name: string; value: string; }> = [];
        headers.push({ name: 'Authorization', value: `Bearer ${token}` });
        headers.push({ name: 'Tenant-Id', value: tenantId });

        const uploaderOptions: FileUploaderOptions = {
            url: `${API_PREFIX}/image-assets/upload/${this.folder}`,
            // XHR request method
            method: 'POST',
            // Upload files automatically upon addition to upload queue
            autoUpload: true,
            // Use xhrTransport in favor of iframeTransport
            isHTML5: true,
            // Calculate progress independently for each uploaded file
            removeAfterUpload: true,
            // XHR request headers
            headers: headers
        };
        this.uploader = new FileUploader(uploaderOptions);
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
