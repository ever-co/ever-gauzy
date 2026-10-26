import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'ngx-no-data-message',
    templateUrl: './no-data-message.component.html',
    styleUrls: ['./no-data-message.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NbCardModule, NbIconModule, TranslatePipe]
})
export class NoDataMessageComponent implements OnInit {
	@Input() message: string;

	constructor() {}

	ngOnInit() {}
}
