import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { ManageCandidateInterviewsComponent } from './manage-candidate-interviews.component';
import { CandidateInterviewInfoComponent } from '../../../@shared/candidate/candidate-interview-info/candidate-interview-info.component';

const routes: Routes = [
	{
		path: '',
		component: ManageCandidateInterviewsComponent
	},
	{
		path: 'interviewsInfo',
		component: CandidateInterviewInfoComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ManageCandidateInterviewRoutingModule {}
