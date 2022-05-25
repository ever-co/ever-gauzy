import { Component, OnInit } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { NotesWithTagsComponent } from '..';

@Component({
	selector: 'gauzy-organization-with-tags',
	templateUrl: './organization-with-tags.component.html',
	styleUrls: ['./organization-with-tags.component.scss']
})
export class OrganizationWithTagsComponent extends NotesWithTagsComponent {}
