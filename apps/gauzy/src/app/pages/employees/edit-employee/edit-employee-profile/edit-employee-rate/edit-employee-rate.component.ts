import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-employee-rates',
    template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
    styles: [
        `
			:host {
				background-color: var(--gauzy-card-2);
				display: flex;
				flex-direction: column;
				overflow-y: auto;
			}

			:host > ga-employee-rates {
				display: flex;
				flex-direction: column;
				height: auto;
				flex: 1 0 auto;
			}
		`
    ],
    standalone: false
})
export class EditEmployeeRatesComponent {}
