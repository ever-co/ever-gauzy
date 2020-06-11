import { Injectable } from '@angular/core';
import { Goals } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class GoalService {
	goals: Goals[] = [
		{
			name: 'Improve User Retention',
			description: '',
			id: 'eef48c64-b4eb-491b-bcfb-e998fb766d2f',
			owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
			lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
			deadline: 'Q3-2020',
			type: 'Organization',
			progress: 40,
			organizationId: 'eef48c64-b4eb-491b-bcfb-e998fb766d2f',
			keyResults: [
				{
					name: 'Establish Cash to Cash Cycle Time',
					description: '',
					type: 'Number',
					targetValue: 10,
					initialValue: 5,
					update: 7,
					progress: 60,
					status: 'on track',
					owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
					lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
					deadline: 'No Custom Deadline'
				},
				{
					name: 'Maintain Pageviews per Week by Q2-2020',
					description: '',
					type: 'True/False',
					targetValue: null,
					initialValue: null,
					update: false,
					progress: 0,
					status: 'none',
					owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
					lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
					deadline: 'Hard deadline',
					hardDeadline: new Date()
				}
			]
		},
		{
			id: 'eef48c64-b4eb-491b-bcfb-e998fb766d2f',
			name: 'Increase Website Engagement',
			description: '',
			owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
			lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
			deadline: 'Q4-2020',
			progress: 70,
			organizationId: 'eef48c64-b4eb-491b-bcfb-e998fb766d2f',
			type: 'Organization',
			keyResults: [
				{
					name: 'Decrease Bounce Rate by Q2-2020',
					description: '',
					type: 'True/False',
					targetValue: null,
					initialValue: null,
					update: false,
					progress: 0,
					status: 'none',
					owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
					lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
					deadline: 'No Custom Deadline'
				},
				{
					name: 'Increase Avg. Pages per Visit by Q2-2020',
					description: '',
					type: 'Number',
					targetValue: 10,
					initialValue: 5,
					update: 6,
					progress: 80,
					status: 'on track',
					owner: '8bd04bc6-a532-4682-9795-d1886c94dfac',
					lead: '935d03d4-39b4-46c0-8390-a04644d7480c',
					deadline: 'Hard deadline',
					hardDeadline: new Date()
				}
			]
		}
	];

	constructor() {}

	getAll() {
		return this.goals;
	}

	update() {}
}
