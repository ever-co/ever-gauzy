import { Component } from "@angular/core";
import { UntilDestroy } from "@ngneat/until-destroy";
import { faqs } from "./faq-setting";


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-faq',
	templateUrl: './faq.component.html',
	styleUrls: ['./faq.component.scss'],
})

export class FaqComponent {
	items = faqs ;
}
