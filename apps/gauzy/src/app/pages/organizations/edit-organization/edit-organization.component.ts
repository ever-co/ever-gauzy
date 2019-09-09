import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Organization, CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { NbToastrService } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

export enum ListsInputType {
    DEPARTMENTS = 'DEPARTMENTS',
    POSITIONS = 'POSITIONS',
    VENDORS = 'VENDORS'
}

@Component({
    selector: 'ngx-edit-organization',
    templateUrl: './edit-organization.component.html',
    styleUrls: [
        './edit-organization.component.scss',
        '../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class EditOrganizationComponent implements OnInit {
    private _ngOnDestroy$ = new Subject();
    organization: Organization;
    form: FormGroup;
    hoverState: boolean;
    currencies: string[] = Object.values(CurrenciesEnum);
    defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
    departments: string[] = [];
    positions: string[] = [];
    vendors: string[] = [];

    constructor(private route: ActivatedRoute,
                private organizationService: OrganizationsService,
                private toastrService: NbToastrService,
                private fb: FormBuilder) { }

    ngOnInit() {
        this.route.params
            .pipe(takeUntil(this._ngOnDestroy$))
            .subscribe(params => {
                this._loadOrganization(params.id);
            });
    }

    updateOrganizationSettings() {

    }

    handleImageUploadError() {
        
    }

    private async _loadOrganization(id: string) {
        try {
            this.organization = await this.organizationService.getById(id).pipe(first()).toPromise();
            this._initializedForm();
        } catch (error) {
            this.toastrService.danger(error.error.message || error.message, 'Error');
        }
    }

    private _initializedForm() {
        this.form = this.fb.group({
            currency: [this.organization.currency, Validators.required],
            name: [this.organization.name, Validators.required],
            imageUrl: [this.organization.imageUrl, Validators.required],
            defaultValueDateType: [this.organization.defaultValueDateType, Validators.required]
        });
    }
}
