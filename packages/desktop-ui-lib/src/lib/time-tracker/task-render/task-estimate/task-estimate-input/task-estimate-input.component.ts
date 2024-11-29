import {
	AfterViewInit,
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import moment from 'moment';;
import { Observable, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

export interface IEstimateInput {
	hourTen: number;
	hourUnit: number;
	minuteTen: number;
	minuteUnit: number;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-task-estimate-input',
	templateUrl: './task-estimate-input.component.html',
	styleUrls: ['./task-estimate-input.component.scss'],
})
export class TaskEstimateInputComponent implements OnInit, AfterViewInit {
	@Output()
	public submit: EventEmitter<number>;
	public timeForm: UntypedFormGroup;
	@Input()
	public estimate$: Observable<number>;
	private estimate: number;

	constructor(private formBuilder: UntypedFormBuilder) {
		this.submit = new EventEmitter<number>();
	}

	public ngOnInit() {
		this.timeForm = this.formBuilder.group({
			hourTen: [
				'',
				[Validators.required, Validators.min(0), Validators.max(9)],
			],
			hourUnit: [
				'',
				[Validators.required, Validators.min(0), Validators.max(9)],
			],
			minuteTen: [
				'',
				[Validators.required, Validators.min(0), Validators.max(5)],
			],
			minuteUnit: [
				'',
				[Validators.required, Validators.min(0), Validators.max(9)],
			],
		});
	}

	public ngAfterViewInit(): void {
		this.estimate$
			.pipe(
				tap((estimate: number) => {
					this.estimate = estimate;
					this.timeForm.patchValue(this.convert(estimate));
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onSubmit(): void {
		const estimate = this.reverse({
			hourTen: this.timeForm.value['hourTen'],
			hourUnit: this.timeForm.value['hourUnit'],
			minuteTen: this.timeForm.value['minuteTen'],
			minuteUnit: this.timeForm.value['minuteUnit'],
		});
		this.submit.emit(estimate === this.estimate ? undefined : estimate);
	}

	private convert(estimate: number): IEstimateInput {
		const durationMoment = moment.duration(estimate, 'seconds');
		const hourTen = Math.floor(durationMoment.asHours() / 10);
		const hourUnit = Math.floor(durationMoment.hours() % 10);
		const minuteTen = Math.floor(durationMoment.minutes() / 10);
		const minuteUnit = Math.floor(durationMoment.minutes() % 10);
		return { hourTen, hourUnit, minuteTen, minuteUnit };
	}

	private reverse(estimateInput: IEstimateInput): number {
		const { hourTen, hourUnit, minuteTen, minuteUnit } = estimateInput;
		const estimateMoment = moment.duration({
			hours: hourTen * 10 + hourUnit,
			minutes: minuteTen * 10 + minuteUnit,
		});
		return estimateMoment.asSeconds();
	}
}
