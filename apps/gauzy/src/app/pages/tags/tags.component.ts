import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-tags',
	templateUrl: './tags.component.html',
	styleUrls: ['./tags.component.scss']
})
export class TagsComponent implements OnInit, OnDestroy {
	// constructor(
	//   private store: Store
	// ) { }
	loading = false;
	settings = {
		columns: {
			id: {
				title: 'ID'
			},
			name: {
				title: 'Full Name'
			},
			username: {
				title: 'User Name'
			},
			email: {
				title: 'Email'
			}
		}
	};

	ngOnInit() {}

	ngOnDestroy() {}
}
