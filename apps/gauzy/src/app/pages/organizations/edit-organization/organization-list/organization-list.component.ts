import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ListsInputType } from '../edit-organization.component';

@Component({
    selector: 'ngx-organization-list',
    templateUrl: './organization-list.component.html',
    styleUrls: ['./organization-list.component.scss']
})
export class OrganizationListComponent {
    @Input()
    list: string[];
    @Input()
    listType: ListsInputType;
    @Output()
    listChanged = new EventEmitter();

    showList: boolean;

    inputHandler(event: any) {
        const val = event.target.value;
        if (val) {
            this.list.unshift(val);
            this.listChanged.emit(this.list);
            event.target.value = '';
        }
    }

    deleteFromList(index: number) {
        this.list.splice(index, 1);
        this.listChanged.emit(this.list);
    }
}
