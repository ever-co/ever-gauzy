import { Component } from "@angular/core"


@Component({
  selector: 'ngx-whats-new',
  templateUrl: './whats-new.component.html',
  styleUrls: ['./whats-new.component.scss'],
})
export class NgxWhatsNewComponent {
  dataMock: any[] = [1,2,3]
  showDate: boolean = true

  constructor () {}
}
