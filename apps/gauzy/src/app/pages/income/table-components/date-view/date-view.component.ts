import { Component, OnInit, Input } from '@angular/core';

@Component({
    selector: 'ngx-date-view',
    template: `
        <span>{{ value | date:'shortDate' }}</span>
    `,
    styles: []
})
export class DateViewComponent {
    @Input() value: Date;
}
