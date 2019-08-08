import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User } from '@gauzy/models';

@Component({
    selector: 'ngx-profile',
    templateUrl: './profile.component.html',
    styleUrls: [
        '../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class ProfileComponent implements OnInit {
    form: FormGroup;
    hoverState: boolean;

    constructor(private fb: FormBuilder,
                private userService: UsersService,
                private store: Store) { }

    async ngOnInit() {
        try {
            const user = await this.userService.getUserById(this.store.userId);
            this._initializeForm(user);
        } catch (error) {
            console.error(error)
        }

    }

    handleImageUploadError(error: any) {
        console.error(error);
    }

    async submitForm() {
        try {
            await this.userService.update(this.store.userId, this.form.value);
        } catch (error) {
            console.error(error)
        }
    }

    private _initializeForm(user: User) {
        this.form = this.fb.group({
            firstName: [user.firstName, Validators.required],
            lastName: [user.lastName, Validators.required],
            imageUrl: [user.imageUrl, Validators.required]
        });
    }
}
