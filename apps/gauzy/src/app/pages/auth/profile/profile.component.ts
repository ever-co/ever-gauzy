import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';

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
                private store: Store,
                private toastrService: NbToastrService) { }

    async ngOnInit() {
        try {
            const user = await this.userService.getUserById(this.store.userId);
            
            this._initializeForm(user);
        } catch (error) {
            this.toastrService.danger(error.error.message || error.message, 'Error');
        }      
    }

    handleImageUploadError(error: any) {
        console.error(error);
    }

    async submitForm() {
        try {
            await this.userService.update(this.store.userId, this.form.value);
            this.toastrService.info('Your profile has been updated successfully.', 'Success');
        } catch (error) {
            this.toastrService.danger(error.error.message || error.message, 'Error');
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
