import { Component, OnInit } from '@angular/core';
import {
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	JobPostSourceEnum,
	JobPostTypeEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { JobService } from 'apps/gauzy/src/app/@core/services/job.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@UntilDestroy()
@Component({
	selector: 'gauzy-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
	loading = false;
	isOpenAdvancedFilter = false;
	jobs: IEmployeeJobPost[] = [];

	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;

	jobRequest: IGetEmployeeJobPostInput = {
		take: 10,
		skip: 0,
		employeeIds: [],
		jobSource: [],
		jobType: [],
		budget: null
	};

	updateJobs$: Subject<any> = new Subject();

	constructor(private jobService: JobService) {}

	ngOnInit(): void {
		this.updateJobs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.jobRequest.skip = 0;
				this.getJobs().then((resp) => {
					this.jobs = resp.items;
				});
			});

		this.updateJobs$.next();
	}

	redirectToView() {}

	applayFilter() {
		this.updateJobs$.next();
	}

	getJobs() {
		return this.jobService.getJobs(this.jobRequest).finally(() => {
			this.loading = false;
		});
	}

	loadMore() {
		this.jobRequest.skip = this.jobRequest.skip + this.jobRequest.take;
		this.getJobs().then((resp) => {
			this.jobs = this.jobs.concat(resp.items);
		});
	}
}
