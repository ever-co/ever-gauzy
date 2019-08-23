import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule, NbDatepickerModule, NbSelectModule, NbToastrModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsMutationComponent } from './organizations-mutation.component';
import { ImageUpladerModule } from '../../image-uploader/image-uploader.module';
import { RemoveLodashPipe } from './remove-lodash.pipe';

@NgModule({
    imports: [
        ThemeModule,
        NbCardModule,
        NbButtonModule,
        NbIconModule,
        NgSelectModule,
        ReactiveFormsModule,
        NbInputModule,
        FormsModule,
        NbDatepickerModule,
        ImageUpladerModule,
        NbSelectModule,
        NbToastrModule.forRoot(),
    ],
    declarations: [OrganizationsMutationComponent, RemoveLodashPipe],
    entryComponents: [OrganizationsMutationComponent],
    providers: []
})
export class OrganizationsMutationModule { }