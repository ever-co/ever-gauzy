import { Component, Input } from '@angular/core'
import { featureIntF } from "../../interfaces"


@Component({
  selector: 'ngx-register-side-single-feature',
  templateUrl: './register-side-single-feature.component.html',
  styleUrls: ['./register-side-single-feature.component.scss'],
})
export class NgxRegisterSideSingleFeatureComponent {
  constructor () {}

  @Input() feature: featureIntF | null = null
}
