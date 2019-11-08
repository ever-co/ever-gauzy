import { Component, OnInit } from '@angular/core';
import { first, takeUntil } from 'rxjs/operators';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent implements OnInit {
	constructor(private store: Store, private router: Router) {}

	private _ngDestroy$ = new Subject<void>();
	selectedOrganizationId: string;
	loading = true;

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					// this.loadPage();
				}
			});
		this.loading = false;
	}

	add() {
		this.router.navigate(['/pages/proposals/register']);
		// TODO: Implement create logic
	}

	edit() {
		this.router.navigate(['/pages/proposals/edit/:id']);
		// TODO: Implement edit logic
	}

	delete() {
		// TODO: Implement delete logic
	}

	changeStatus() {
		// TODO: Implement change status logic
	}
}
