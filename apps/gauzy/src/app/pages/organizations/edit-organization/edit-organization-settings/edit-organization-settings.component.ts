import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Organization } from '@gauzy/models';
import { OrganizationsService } from '../../../../@core/services/organizations.service';
import { NbToastrService } from '@nebular/theme';
import { Location } from '@angular/common';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';

export enum ListsInputType {
    DEPARTMENTS = 'DEPARTMENTS',
    POSITIONS = 'POSITIONS',
    VENDORS = 'VENDORS'
}

@Component({
    selector: 'ngx-edit-organization-settings',
    templateUrl: './edit-organization-settings.component.html',
    styleUrls: [
        './edit-organization-settings.component.scss',
        '../../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
    ]
})
export class EditOrganizationSettingsComponent implements OnInit {
    @ViewChild('main', { static: false })
    main: EditOrganizationMainComponent;

    imageUrl: string;

    organization: Organization;
    hoverState: boolean;
    departments: string[] = [];
    positions: string[] = [];
    vendors: string[] = [];

    private _activeTabName = "Main";
    private _ngOnDestroy$ = new Subject();

    constructor(private route: ActivatedRoute,
        private organizationService: OrganizationsService,
        private toastrService: NbToastrService,
        private location: Location) { }

    get activeTabName() {
        return this._activeTabName.toLowerCase();
    }

    tabChange(e) {
        this._activeTabName = e.tabTitle.toLowerCase();
        const currentURL = window.location.href;

        if (!currentURL.endsWith("/settings") || this._activeTabName.toLowerCase() !== "main") {
            window.location.href = currentURL.substring(0, currentURL.indexOf('/settings') + 9) + `/${this._activeTabName}`;
        }
    }

    ngOnInit() {
        this.route.params
            .pipe(takeUntil(this._ngOnDestroy$))
            .subscribe(params => {
                const tabName = params.tab;
                if (tabName) {
                    this._activeTabName = tabName;
                }

                this._loadOrganization(params.id);
            });
    }

    goBack() {
        const currentURL = window.location.href;
        window.location.href = currentURL.substring(0, currentURL.indexOf('/settings'));
    }

    async updateOrganizationSettings() {
        this.organizationService.update(this.organization.id, {
            imageUrl: this.imageUrl,
            ...this.main.mainUpdateObj
        })

        this.goBack();
    }

    handleImageUploadError() {

    }

    updateImageUrl(url: string) {
        this.imageUrl = url;
    }

    private async _loadOrganization(id: string) {
        try {
            this.organization = await this.organizationService.getById(id).pipe(first()).toPromise();
            this.imageUrl = this.organization.imageUrl;

        } catch (error) {
            this.toastrService.danger(error.error.message || error.message, 'Error');
        }
    }
}
