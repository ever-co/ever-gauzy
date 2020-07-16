import { Component } from '@angular/core';

@Component({
	selector: 'ga-edit-organization-documents',
	templateUrl: './edit-organization-documents.html'
})

export class EditOrganizationDocuments {
    loading = false;
    documentUrl = '';

    constructor() { }

}