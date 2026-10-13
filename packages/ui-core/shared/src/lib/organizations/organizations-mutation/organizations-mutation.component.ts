import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
@Component({
    selector: 'ga-organizations-mutation',
    templateUrl: './organizations-mutation.component.html',
    styleUrls: ['./organizations-mutation.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class OrganizationsMutationComponent implements OnInit {
	constructor(protected readonly dialogRef: NbDialogRef<OrganizationsMutationComponent>) {}

	ngOnInit() {}

	addOrganization(consolidatedFormValues) {
		this.dialogRef.close(consolidatedFormValues);
	}

	public close() {
		this.dialogRef.close();
	}
}
