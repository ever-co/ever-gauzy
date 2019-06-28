import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';

@NgModule({
    imports: [
        OrganizationsRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
    ],
    declarations: [
        OrganizationsComponent
    ]
})
export class OrganizationsModule { }