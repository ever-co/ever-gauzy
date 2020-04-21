import { Component, OnInit, Input } from '@angular/core';

@Component({
	selector: 'ngx-avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
	@Input('size') size: 'lg' | 'sm' | 'md' = 'md';
	@Input('src') src: string;
	@Input('name') name: string;
	constructor() {}

	ngOnInit() {}
}
