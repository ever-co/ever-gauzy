import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
  selector: 'ga-income-mutation',
  templateUrl: './income-mutation.component.html',
  styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent {

  constructor(protected dialogRef: NbDialogRef<IncomeMutationComponent>) { }
}
