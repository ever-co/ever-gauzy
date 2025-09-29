import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
	NbThemeModule,
	NbLayoutModule,
	NbSidebarModule,
	NbMenuModule,
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbActionsModule,
	NbSelectModule,
	NbToggleModule,
	NbListModule,
	NbBadgeModule,
	NbUserModule,
	NbTabsetModule,
	NbTooltipModule,
	NbProgressBarModule,
	NbSpinnerModule,
	NbContextMenuModule,
	NbInputModule,
	NbCheckboxModule,
	NbAlertModule
} from '@nebular/theme';

import { AgentDashboardComponent } from './agent-dashboard.component';
import { LogsPageComponent } from './logs/logs.component';
import { SyncPageComponent } from './activity-sync/activity-sync.component';
import { FilterStatusPipe } from './pipes/filter.status.pipe';

@NgModule({
	declarations: [AgentDashboardComponent, LogsPageComponent, SyncPageComponent],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		FormsModule,
		ReactiveFormsModule,
		RouterModule,
		NbThemeModule.forRoot({ name: 'dark' }),
		NbLayoutModule,
		NbSidebarModule.forRoot(),
		NbMenuModule,
		NbIconModule,
		NbButtonModule,
		NbCardModule,
		NbActionsModule,
		NbSelectModule,
		NbToggleModule,
		NbListModule,
		NbBadgeModule,
		NbUserModule,
		NbTabsetModule,
		NbTooltipModule,
		NbProgressBarModule,
		NbSpinnerModule,
		NbContextMenuModule,
		NbInputModule,
		NbCheckboxModule,
		NbAlertModule,
		FilterStatusPipe
	],
	exports: [
		// LogsPageComponent,
		// SyncPageComponent,
		FilterStatusPipe
	]
})
export class AgentDashboardModule { }
