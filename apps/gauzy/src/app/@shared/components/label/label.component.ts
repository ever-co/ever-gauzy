import { Component, OnInit, Input } from '@angular/core';
import { NbComponentStatus, NbComponentSize } from '@nebular/theme';

@Component({
	selector: 'ngx-label',
	templateUrl: './label.component.html',
	styleUrls: ['./label.component.scss']
})
export class LabelComponent implements OnInit {
	@Input() status: NbComponentStatus = 'primary';
	@Input() size: NbComponentSize = 'medium';
	@Input() text: string;

	constructor() {}

	ngOnInit() {}
}
