import { NbAuthComponent } from "@nebular/auth"
import { Component } from "@angular/core"


@Component({
  selector: 'ngx-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class NgxAuthComponent extends NbAuthComponent {}
