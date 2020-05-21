import { Component, OnInit } from '@angular/core';

export interface IApprovalsData {
  icon: string;
  title: string;
}

@Component({
  selector: 'ngx-approvals',
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent implements OnInit {

  public listApprovals: IApprovalsData[] = [];

  constructor() { }

  ngOnInit() {
    this.initListApprovals();
  }

  private initListApprovals() {
    this.listApprovals = [
      {
        icon: 'paper-plane-outline',
        title: 'Business Trip'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Borrow Items'
      },
      {
        icon: 'paper-plane-outline',
        title: 'General Approval'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Contract Approval'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Payment Application'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Car Rental Application'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Job Referral Award'
      },
      {
        icon: 'paper-plane-outline',
        title: 'Procurement'
      }
    ]
  }

}
