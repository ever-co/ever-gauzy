import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
    template: `
    <div style="display: flex; align-items: center;">
        <div class="image-container">
            <img  [src]="rowData.imageUrl">
        </div>
        <div class="d-block" style="margin-left:15px;">{{ rowData.fullName }}</div>
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
export class EmployeeFullNameComponent implements ViewCell {
    @Input()
    rowData: any;

    value: string | number;
}
