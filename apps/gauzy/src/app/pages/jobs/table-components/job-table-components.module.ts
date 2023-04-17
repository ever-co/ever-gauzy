import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { JobTitleDescriptionDetailsComponent } from './job-title-description-details/job-title-description-details.component';
import { SharedModule } from '../../../@shared/shared.module';

@NgModule({
    imports: [
        CommonModule,
        SharedModule
    ],
    declarations: [
        JobTitleDescriptionDetailsComponent
    ],
    exports: [
        JobTitleDescriptionDetailsComponent
    ]
})
export class JobTableComponentsModule { }
