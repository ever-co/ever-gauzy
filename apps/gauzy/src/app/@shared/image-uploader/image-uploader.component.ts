import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Cloudinary } from '@cloudinary/angular-5.x';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';

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
    `
})
export class ImageUploaderComponent implements OnInit {
    @Input()
    styles: Object = {
        width: '100%',
        height: '100%',
        opacity: '0',
        position: 'absolute',
        zIndex: 3,
        cursor: 'pointer'
    };
    @Output()
    changeHoverState = new EventEmitter<boolean>();
    @Output()
    uploadedImageUrl = new EventEmitter<string>();
    @Output()
    uploadImageError = new EventEmitter<any>();

    uploader: FileUploader;

    constructor(private cloudinary: Cloudinary) { }

    ngOnInit() {
        this._loadUploaderSettings();
    }

    handlePhotoUpload() {
        if (this.uploader.queue.length > 0) {
            this.uploader.queue[this.uploader.queue.length - 1].upload();
        }
    }

    private _loadUploaderSettings() {
        const uploaderOptions: FileUploaderOptions = {
            url: `https://api.cloudinary.com/v1_1/${this.cloudinary.config().cloud_name}/upload`,
            // Upload files automatically upon addition to upload queue
            autoUpload: true,
            // Use xhrTransport in favor of iframeTransport
            isHTML5: true,
            // Calculate progress independently for each uploaded file
            removeAfterUpload: true,
            // XHR request headers
            headers: [
                {
                    name: 'X-Requested-With',
                    value: 'XMLHttpRequest'
                }
            ]
        };

        this.uploader = new FileUploader(uploaderOptions);

        this._attachListeners();
    }

    private _attachListeners() {
        this.uploader.onBuildItemForm = (fileItem: any, form: FormData): any => {
            form.append('upload_preset', 'ml_default');
            form.append('context', `photo=${fileItem.file.name}`);
            form.append('folder', 'gauzy_profile_pictures');
            form.append('file', fileItem);

            fileItem.withCredentials = false;
            return { fileItem, form };
        };

        this.uploader.onSuccessItem = (item: any, response: string, status: number) => {
            const data = JSON.parse(response);
            this.uploadedImageUrl.emit(data.url);
        };

        this.uploader.onErrorItem = (item: any, response: string, status: number) => {
            const error = JSON.parse(response);
            this.uploadImageError.emit(error);
        };
    }
}
