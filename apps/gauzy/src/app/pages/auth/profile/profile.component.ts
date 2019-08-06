import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User } from '@gauzy/models';

@Component({
    selector: 'ngx-profile',
    templateUrl: './profile.component.html',
    styleUrls: [
        './profile.component.scss',
        '../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class ProfileComponent implements OnInit {
    protected form: FormGroup;
    profilePhoto: string;

    constructor(private fb: FormBuilder,
                private userService: UsersService,
                private store: Store) { }

    async ngOnInit() {
        const user = await this.userService.getUserById(this.store.userId);

        this._initializeForm(user)
    }

    handlePhotoUpload(ev: Event) {
        const file = (<HTMLInputElement>ev.target).files[0];
        console.log('Not implemented yet! \r\n', file);
    }

    private _initializeForm(user: User) {
        this.form = this.fb.group({
            firstName: [user.firstName, Validators.required],
            lastName: [user.lastName, Validators.required]
        });

        this.profilePhoto = user.imageUrl;
    }
}
