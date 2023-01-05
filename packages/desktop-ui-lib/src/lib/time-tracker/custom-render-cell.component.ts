import { Component, Input, OnInit } from '@angular/core';

import { ViewCell } from 'ng2-smart-table';

@Component({
  template: `
    <div class="d-flex align-items-center">
        <nb-icon class="running-task" status="primary" icon="arrow-right-outline" *ngIf="isSelected"></nb-icon>
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
    this.renderValue = this.rowData.taskNumber +' '+ this.rowData.title;
    if (this.rowData.isSelected) {
        this.isSelected = true;
    }
  }

}

@Component({
  template: `
    <span class="hidden-long-text">
        {{renderValue}}
    </span>
  `,
  styleUrls: ['./time-tracker.component.scss'],
})
export class CustomDescriptionComponent implements ViewCell, OnInit {

  renderValue: string;

  @Input() value: string | number;
  @Input() rowData: any;

  ngOnInit() {
    this.renderValue = this.value.toString();
  }

}