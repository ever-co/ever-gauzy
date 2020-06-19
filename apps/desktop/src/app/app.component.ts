import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent {
	constructor(private router: Router) {}
}
