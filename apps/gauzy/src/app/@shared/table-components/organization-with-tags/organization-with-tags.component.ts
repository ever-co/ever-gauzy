import { Component } from '@angular/core';
import { NotesWithTagsComponent } from '..';

@Component({
	selector: 'gauzy-organization-with-tags',
	templateUrl: './organization-with-tags.component.html',
	styleUrls: ['./organization-with-tags.component.scss']
})
export class OrganizationWithTagsComponent extends NotesWithTagsComponent {}
