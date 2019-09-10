import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginGoogleComponent } from './login-google.component';

const routes: Routes = [{
  path: 'google',
  component: LoginGoogleComponent,
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LoginGoogleRoutingModule {
}
