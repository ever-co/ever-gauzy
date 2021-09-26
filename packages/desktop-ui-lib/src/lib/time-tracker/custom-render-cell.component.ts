import { Component, Input, OnInit } from '@angular/core';

import { ViewCell } from 'ng2-smart-table';

@Component({
  template: `
    <div>
        <nb-icon icon="arrow-right" class="icon-process" *ngIf="isSelected"></nb-icon>
        {{renderValue}}
    </div>
  `,
  styleUrls: ['./time-tracker.component.scss'],
})
export class CustomRenderComponent implements ViewCell, OnInit {

  renderValue: string;

  @Input() value: string | number;
  @Input() rowData: any;
  isSelected: boolean = false;

  ngOnInit() {
    this.renderValue = this.value.toString();
    if (this.rowData.isSelected) {
        this.isSelected = true;
    }
  }

}