import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TaskCacheService } from '../../services';
import { ProjectSelectorModule } from '../../shared/features/project-selector/project-selector.module';
import { TaskSelectorModule } from '../../shared/features/task-selector/task-selector.module';
import { TeamSelectorModule } from '../../shared/features/team-selector/team-selector.module';
import { TaskTableQuery } from './+state/task-table.query';
import { TaskTableStore } from './+state/task-table.store';
import { ActionButtonQuery } from './action-button/+state/action-button.query';
import { ActionButtonStore } from './action-button/+state/action-button.store';
import { SearchTermQuery } from './search/+state/search-term.query';
import { SearchTermStore } from './search/+state/search-term.store';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbTooltipModule,
		NbIconModule,
		NbCardModule,
		NbFormFieldModule,
		NbInputModule,
		TaskSelectorModule,
		ProjectSelectorModule,
		TeamSelectorModule,
		TranslateModule.forChild(),
		Angular2SmartTableModule,
		NbSpinnerModule,
		RouterModule.forChild([
			{
				path: '',
				loadComponent: () => import('./table/task-table.component').then((m) => m.TaskTableComponent)
			}
		])
	],
	providers: [
		ActionButtonStore,
		SearchTermStore,
		TaskTableStore,
		ActionButtonQuery,
		SearchTermQuery,
		TaskTableQuery,
		TaskCacheService
	]
})
export class TaskTableModule {}
