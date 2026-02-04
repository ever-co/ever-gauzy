import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageElectronService } from '@gauzy/desktop-ui-lib';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>',
	imports: [RouterOutlet]
})
export class AppComponent implements OnInit {
	constructor(private readonly languageElectronService: LanguageElectronService) {}

	ngOnInit(): void {
		this.languageElectronService.initialize<void>();
	}
}
