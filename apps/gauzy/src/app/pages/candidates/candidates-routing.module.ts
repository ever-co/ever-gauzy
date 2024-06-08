import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { InviteGuard, PermissionsGuard } from '@gauzy/ui-sdk/core';
import { EditCandidateInterviewComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-interview/edit-candidate-interview.component';
import { CandidatesComponent } from './candidates.component';
import { ManageCandidateInviteComponent } from './manage-candidate-invite/manage-candidate-invite.component';
import { EditCandidateComponent } from './edit-candidate/edit-candidate.component';
import { EditCandidateProfileComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-profile.component';
import { EditCandidateMainComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-main/edit-candidate-main.component';
import { EditCandidateDocumentsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-documents/edit-candidate-documents.component';
import { EditCandidateHistoryComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-history/edit-candidate-history.component';
import { EditCandidateLocationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-location/edit-candidate-location.component';
import { EditCandidateHiringComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-hiring/edit-candidate-hiring.component';
import { EditCandidateEmploymentComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-employment/edit-candidate-employment.component';
import { EditCandidateTasksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-tasks/edit-candidate-tasks.component';
import { EditCandidateExperienceComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience.component';
import { EditCandidateRatesComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-rates/edit-candidate-rates.component';
import { EditCandidateFeedbacksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/edit-candidate-feedbacks.component';
import { ManageCandidateInterviewsComponent } from './manage-candidate-interviews/manage-candidate-interviews.component';
import { CandidateStatisticComponent } from './candidate-statistic/candidate-statistic.component';
import { InterviewCalendarComponent } from './manage-candidate-interviews/interview-calendar/interview-calendar.component';
import { InterviewPanelComponent } from './manage-candidate-interviews/interview-panel/interview-panel.component';
import { InterviewCriterionsComponent } from './manage-candidate-interviews/interview-criterions/interview-criterions.component';

const routes: Routes = [
	{
		path: '',
		component: CandidatesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CANDIDATES_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false
			}
		}
	},
	{
		path: 'edit/:id',
		component: EditCandidateComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CANDIDATES_EDIT],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		path: 'edit/:id/profile',
		component: EditCandidateProfileComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CANDIDATES_EDIT],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'account',
				pathMatch: 'full'
			},
			{
				path: 'account',
				component: EditCandidateMainComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'rates',
				component: EditCandidateRatesComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'tasks',
				component: EditCandidateTasksComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'experience',
				component: EditCandidateExperienceComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'documents',
				component: EditCandidateDocumentsComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'feedbacks',
				component: EditCandidateFeedbacksComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'history',
				component: EditCandidateHistoryComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'location',
				component: EditCandidateLocationComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'hiring',
				component: EditCandidateHiringComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'employment',
				component: EditCandidateEmploymentComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'interview',
				component: EditCandidateInterviewComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			}
		]
	},
	{
		path: 'invites',
		component: ManageCandidateInviteComponent,
		canActivate: [InviteGuard],
		data: {
			expectedPermissions: [PermissionsEnum.ORG_INVITE_EDIT, PermissionsEnum.ORG_INVITE_VIEW],
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		path: 'interviews',
		component: ManageCandidateInterviewsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'calendar',
				pathMatch: 'full'
			},
			{
				path: 'calendar',
				component: InterviewCalendarComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'interview_panel',
				component: InterviewPanelComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'criterion',
				component: InterviewCriterionsComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			}
		]
	},
	{
		path: 'statistic',
		component: CandidateStatisticComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CANDIDATES_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class CandidatesRoutingModule {}
