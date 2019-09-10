import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { LoginGoogleComponent } from './login-google.component';
import { LoginGoogleRoutingModule } from './login-google-routing.module';

@NgModule({
    imports: [
      LoginGoogleRoutingModule,
      ThemeModule,
      NbCardModule,
      FormsModule,
      NbButtonModule,
      NbInputModule,
      NbSpinnerModule,
    ],
    declarations: [
        LoginGoogleComponent
    ]
})
export class LoginGoogleModule { }
