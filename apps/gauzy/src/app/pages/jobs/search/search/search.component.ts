import { Component, OnInit } from '@angular/core';
import { EmployeeJobPost, JobPost } from '@gauzy/models';
import { JobService } from 'apps/gauzy/src/app/@core/services/job.service';

@Component({
	selector: 'gauzy-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
	loading = false;
	jobs: EmployeeJobPost[];

	jobRequest: any = {};

	constructor(private jobService: JobService) {}

	ngOnInit(): void {}

	redirectToView() {}

	getJobs() {
		this.jobService.getJobs();
	}
}
