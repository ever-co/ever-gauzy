import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
@Component({
	selector: 'ga-organizations-mutation',
	templateUrl: './organizations-mutation.component.html'
})
export class OrganizationsMutationComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	constructor(
		protected dialogRef: NbDialogRef<OrganizationsMutationComponent>
	) {}

	async ngOnInit() {}

	addOrganization(consolidatedFormValues) {
		this.dialogRef.close(consolidatedFormValues);
	}
}
