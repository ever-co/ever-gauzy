import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User } from '@gauzy/models';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import { Cloudinary } from '@cloudinary/angular-5.x';

@Component({
    selector: 'ngx-profile',
    templateUrl: './profile.component.html',
    styleUrls: [
        '../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class ProfileComponent implements OnInit {
    form: FormGroup;
    uploader: FileUploader;
    hoverState: boolean;

    constructor(private fb: FormBuilder,
        private userService: UsersService,
        private store: Store,
        private cloudinary: Cloudinary) { }

    async ngOnInit() {
        this._loadUploaderSettings();
        try {
            const user = await this.userService.getUserById(this.store.userId);
            this._initializeForm(user);
        } catch (error) {
            console.error(error)
        }

    }

    handlePhotoUpload() {
        if (this.uploader.queue.length > 0) {
            this.uploader.queue[this.uploader.queue.length - 1].upload();
        }
    }

    async submitForm() {
        try {
            await this.userService.update(this.store.userId, this.form.value);
        } catch (error) {
            console.error(error)
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
            this.form.get('imageUrl').setValue(data.url);
        };

        this.uploader.onErrorItem = (item: any, response: string, status: number) => {
            const error = JSON.parse(response);
            console.error(error);
        };
    }

    private _initializeForm(user: User) {
        this.form = this.fb.group({
            firstName: [user.firstName, Validators.required],
            lastName: [user.lastName, Validators.required],
            imageUrl: [user.imageUrl, Validators.required]
        });
    }
}
