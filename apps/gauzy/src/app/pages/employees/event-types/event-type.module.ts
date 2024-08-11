import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbDialogModule,
	NbToastrModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EventTypeService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { EventTypeRoutingModule } from './event-type.routing.module';
import { EventTypeComponent } from './event-type.component';
import { EventTypeMutationModule } from './event-type-mutation/event-type-mutation.module';

@NgModule({
	imports: [
		TableComponentsModule,
		TagsColorInputModule,
		EventTypeRoutingModule,
		SharedModule,
		NbToastrModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		EventTypeMutationModule,
		UserFormsModule,
		CardGridModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		SmartDataViewLayoutModule
	],
	declarations: [EventTypeComponent],
	providers: [EventTypeService]
})
export class EventTypeModule {}
