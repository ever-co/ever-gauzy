import { FormControl } from '@angular/forms';

export interface IVideoEditForm {
	title: FormControl<string>;
	description: FormControl<string>;
}
