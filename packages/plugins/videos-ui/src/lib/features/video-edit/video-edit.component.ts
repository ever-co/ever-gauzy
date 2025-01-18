import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IVideoEditForm } from '../../shared/models/video-edit-form.model';
import { NbDialogRef } from '@nebular/theme';
import { IVideo } from '../../shared/models/video.model';

@Component({
	selector: 'plug-video-edit',
	templateUrl: './video-edit.component.html',
	styleUrl: './video-edit.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoEditComponent implements OnInit {
	public form: FormGroup<IVideoEditForm>;
	public video!: IVideo;

	constructor(protected dialogRef: NbDialogRef<VideoEditComponent>) {}

	public ngOnInit(): void {
		const { title, description = '' } = this.video || {};
		this.form = new FormGroup<IVideoEditForm>({
			title: new FormControl(title, [Validators.required, Validators.minLength(3), Validators.maxLength(255)]),
			description: new FormControl(description, [Validators.maxLength(1000)])
		});
	}

	public close(): void {
		this.dialogRef.close();
	}

	public submit(): void {
		if (this.form.invalid) {
			return;
		}
		this.dialogRef.close(this.form.value);
	}
}
