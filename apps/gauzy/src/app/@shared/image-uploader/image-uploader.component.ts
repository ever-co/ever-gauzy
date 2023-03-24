import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { filter, tap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '../../@core/services';
import { API_PREFIX } from '../../@core/constants';

@UntilDestroy()
@Component({
    selector: 'ngx-image-uploader',
    template: `
		<input
			type="file"
			accept="image/*"
			(change)="handlePhotoUpload()"
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

    user: IUser;
    /*
    * Getter & Setter for dynamic file uploade style element
    */
    _styles: Object = {
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
    _folder: string = 'profile_pictures';
    get folder(): string {
        return this._folder;
    }
    @Input() set folder(value: string) {
        this._folder = value;
    }

    @Output() changeHoverState = new EventEmitter<boolean>();
    @Output() uploadedImageUrl = new EventEmitter<string>();
    @Output() uploadImageError = new EventEmitter<any>();

    uploader: FileUploader;

    constructor(
        private readonly store: Store,
    ) { }

    ngOnInit() {
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
        this.uploader.onSuccessItem = (item: any, response: string, status: number) => {
            console.log({ item, response, status });
            if (response) {
                const data = JSON.parse(response);
                this.uploadedImageUrl.emit(data.url);
            }
        };
        this.uploader.onErrorItem = (item: any, response: string, status: number) => {
            console.log({ item, response, status });
            if (response) {
                const error = JSON.parse(response);
                this.uploadImageError.emit(error);
            }
        };
    }

    handlePhotoUpload() {
        if (this.uploader.queue.length > 0) {
            this.uploader.queue[this.uploader.queue.length - 1].upload();
        }
    }

    private _loadUploaderSettings() {
        if (!this.user) {
            return;
        }
        const { token } = this.store;
        const { tenantId } = this.user;

        const headers: Array<{ name: string; value: string; }> = [];
        headers.push({ name: 'Authorization', value: `Bearer ${token}` });
        headers.push({ name: 'Tenant-Id', value: tenantId });

        const uploaderOptions: FileUploaderOptions = {
            url: `${API_PREFIX}/image-assets/upload/profile_pictures_avatars`,
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
}
