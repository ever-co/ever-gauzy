import { Component, OnInit, Input } from '@angular/core';
import { IUser } from '@gauzy/contracts';

@Component({
  selector: 'gauzy-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {

  @Input() showIdentity: boolean = false;
  @Input() user: IUser;

  constructor() { }

  ngOnInit(): void {
  }

}
