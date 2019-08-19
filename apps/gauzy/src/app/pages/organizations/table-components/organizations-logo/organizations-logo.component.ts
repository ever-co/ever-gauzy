import { Component, OnInit, Input } from '@angular/core';

@Component({
    selector: 'ngx-organizations-logo',
    template: `
        <div class="image-container">
            <img  [src]="rowData.imageUrl">
        </div> 
    `,
    styles: [`
        .image-container {
            width: 70px;
            height: 63px;
            display: flex;
            justify-content: center;
        }

        img {
            height: 100%;
            max-width: 70px;
        }
    `]
})
export class OrganizationsLogoComponent {
    @Input()
    rowData: any;

    value: string | number;
}
