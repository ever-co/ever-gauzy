import { Component, OnDestroy, OnInit } from '@angular/core';
import { ComponentLayoutStyleEnum, IUser, IUserUpdateInput } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { UsersService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss'],
	standalone: false
})
export class LayoutSelectorComponent implements OnInit, OnDestroy {
	user: IUser;
	componentLayouts = Object.values(ComponentLayoutStyleEnum);
	preferredComponentLayout: ComponentLayoutStyleEnum = ComponentLayoutStyleEnum.TABLE;

	constructor(private readonly store: Store, private readonly userService: UsersService) {}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(({ preferredComponentLayout }: IUser) => {
					if (preferredComponentLayout) {
						this.store.preferredComponentLayout = preferredComponentLayout;
					} else {
						this.store.preferredComponentLayout = ComponentLayoutStyleEnum.TABLE;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.preferredComponentLayout$
			.pipe(
				filter((preferredLayout: ComponentLayoutStyleEnum) => !!preferredLayout),
				tap((preferredLayout: ComponentLayoutStyleEnum) => (this.preferredComponentLayout = preferredLayout)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	switchComponentLayout() {
		this.store.preferredComponentLayout = this.preferredComponentLayout;
		this.changePreferredComponentLayout({
			preferredComponentLayout: this.preferredComponentLayout
		});
	}

	resetLayoutForAllComponents() {
		this.store.componentLayout = [];
	}

	/**
	 * Updates the user's preferred component layout.
	 *
	 * @param input - User update payload containing layout preferences.
	 */
	private async changePreferredComponentLayout(input: IUserUpdateInput): Promise<void> {
		if (!this.user) {
			console.warn('No user available. Skipping preferred layout update.');
			return;
		}

		try {
			await this.userService.updatePreferredComponentLayout(input);
		} catch (error) {
			console.error('Failed to update user preferred component layout:', error);
		}
	}

	ngOnDestroy(): void {}
}
