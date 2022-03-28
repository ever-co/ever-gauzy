import { Component } from '@angular/core';
import { IRegisterSideFeature } from "@gauzy/contracts";


@Component({
  selector: 'ngx-register-side-features',
  templateUrl: './register-side-features.component.html',
  styleUrls: ['./register-side-features.component.scss'],
})
export class NgxRegisterSideFeaturesComponent {
  featuresData: IRegisterSideFeature[] = [{
    icon: 'cube-outline',
    heading: 'New CRM',
    description: 'Now you can read latest features changelog directly in Gauzy',
    imageSrc: 'a',
  }, {
    icon: 'globe-outline',
    heading: 'Most popular in 20 countries',
    description: 'Europe, Americas and Asia get choise',
    imageSrc: 'a',
  }, {
    icon: 'flash-outline',
    heading: 'Visit our website',
    description: 'You are welcome to check more information about the platform at our official website.',
  }];

  constructor () {}
}
