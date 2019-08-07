import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-delete-confirmation',
    template: `
        <nb-card class="center">
            <nb-card-header>
              <h6>Confirm</h6>
            </nb-card-header>
            <nb-card-body>
              <span>
                Are you sure you want to delete this {{recordType}} record?
              </span>
            </nb-card-body>
            <nb-card-footer>
              <button (click)="close()" class="mr-3" status="info" nbButton>Cancel</button>
              <button (click)="delete()" status="danger" nbButton>OK</button>
            </nb-card-footer>
        </nb-card>
    `,
    styles: [`
        .center {
            align-items: center;
            width: 300px;
        }
    `]
})
export class DeleteConfirmationComponent {
    recordType: string;

    constructor(protected dialogRef: NbDialogRef<DeleteConfirmationComponent>) { }

    close() {
      this.dialogRef.close();
    }

    delete() {
      this.dialogRef.close('ok');
    }
}
