import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule, NbDialogModule, NbSelectModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { OrganizationsFullnameComponent } from './table-components/organizations-fullname/organizations-fullname.component';
import { OrganizationsLogoComponent } from './table-components/organizations-logo/organizations-logo.component';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';

@NgModule({
    imports: [
        OrganizationsRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        ReactiveFormsModule,
        NbButtonModule,
        NbInputModule,
        Ng2SmartTableModule,
        NbIconModule,
        NbDialogModule.forChild(),
        OrganizationsMutationModule,
        UserFormsModule
    ],
    entryComponents: [
        OrganizationsFullnameComponent,
        OrganizationsLogoComponent
    ],
    declarations: [
        OrganizationsComponent,
        OrganizationsFullnameComponent,
        OrganizationsLogoComponent
    ]
})
export class OrganizationsModule { }