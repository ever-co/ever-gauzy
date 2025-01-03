import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { FileStorageProviderEnum } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'file-provider-selector',
    templateUrl: './file-provider-selector.component.html',
    styleUrls: ['./file-provider-selector.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => FileProviderSelectorComponent),
            multi: true
        }
    ],
    standalone: false
})
export class FileProviderSelectorComponent implements OnInit {
	public fileStorageProviders: { label: FileStorageProviderEnum; value: any }[] = [];

	/**
	 * Getter & Setter for dynamic provider
	 */
	private _provider: FileStorageProviderEnum;
	set provider(val: FileStorageProviderEnum) {
		this._provider = val;
		this.onChange(val);
		this.onTouched(val);
	}
	@Input() get provider(): FileStorageProviderEnum {
		return this._provider;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() onSelectionChanged = new EventEmitter();

	ngOnInit(): void {
		this.fileStorageProviders = Object.keys(FileStorageProviderEnum).map((label: FileStorageProviderEnum) => ({
			label,
			value: FileStorageProviderEnum[label]
		}));
	}

	/**
	 *
	 * @param value
	 */
	writeValue(value: FileStorageProviderEnum): void {
		if (value) {
			this._provider = value;
		}
	}

	/**
	 *
	 * @param fn
	 */
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	/**
	 *
	 * @param fn
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 * On changed file storage provider
	 *
	 * @param provider
	 */
	onSelectionChange(provider: FileStorageProviderEnum): void {
		if (provider) {
			this.onSelectionChanged.emit(provider);
		}
	}
}
