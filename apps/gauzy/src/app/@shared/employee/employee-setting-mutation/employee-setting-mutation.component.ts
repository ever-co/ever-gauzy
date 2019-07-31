import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';

@Component({
  selector: 'ngx-employee-setting-mutation',
  templateUrl: './employee-setting-mutation.component.html',
  styleUrls: ['./employee-setting-mutation.component.scss']
})
export class EmployeeSettingMutationComponent implements OnInit {

  constructor(private fb: FormBuilder,
    protected dialogRef: NbDialogRef<EmployeeSettingMutationComponent>) { }

  ngOnInit() {
  }

}
