import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { CurrenciesEnum, Organization } from '@gauzy/models';

@Component({
    selector: 'ngx-organizations-mutation',
    templateUrl: './organizations-mutation.component.html',
    styleUrls: [
        './organizations-mutation.component.scss',
        '../../../pages/employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class OrganizationsMutationComponent implements OnInit {
    form: FormGroup;
    organization?: Organization;
    hoverState: boolean;
    currencies: string[] = Object.values(CurrenciesEnum)

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<OrganizationsMutationComponent>,
        private toastrService: NbToastrService) { }

    ngOnInit() {
        this._initializedForm();
    }

    addOrEditOrganization() {
        this.dialogRef.close(this.form.value);
    }

    handleImageUploadError(error) {
        this.toastrService.danger(error, 'Error')
    }

    private _initializedForm() {
        if (this.organization) {
            this.form = this.fb.group({
                currency: [this.organization.currency, Validators.required],
                name: [this.organization.name, Validators.required],
                imageUrl: [this.organization.imageUrl, Validators.required]
            });
        } else {
            this.form = this.fb.group({
                currency: ['', Validators.required],
                name: ['', Validators.required],
                imageUrl: ['someimage.jpeg', Validators.required] // TODO: fix that when the internet is here!
            });
        }
    }
}
