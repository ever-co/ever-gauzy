import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-miscellaneous-outlet',
    template: ` <router-outlet></router-outlet> `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MiscellaneousComponent {}
