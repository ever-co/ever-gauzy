import { Component, OnInit } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { ProposalViewModel } from '../proposals.component';

@Component({
	selector: 'ngx-proposal-details',
	templateUrl: './proposal-details.component.html',
	styleUrls: ['./proposal-details.component.scss']
})
export class ProposalDetailsComponent implements OnInit {
	constructor(private store: Store) {}

	proposal: ProposalViewModel;

	ngOnInit() {
		console.log(this.store.selectedProposal);
		this.proposal = this.store.selectedProposal;
	}
}
