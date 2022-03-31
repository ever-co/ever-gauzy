import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
  selector: 'ngx-employees-merged-teams',
  templateUrl: './employees-merged-teams.component.html',
  styleUrls: ['./employees-merged-teams.component.scss']
})
export class EmployeesMergedTeamsComponent implements ViewCell {
  value: any;
  rowData: any;

  constructor() { }

}
