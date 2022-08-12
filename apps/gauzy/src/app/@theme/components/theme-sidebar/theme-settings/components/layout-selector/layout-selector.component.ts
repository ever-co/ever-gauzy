import { Component, OnDestroy, OnInit } from '@angular/core';
import { ComponentLayoutStyleEnum, IUser, IUserUpdateInput } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { UsersService } from './../../../../../../@core';
import { Store } from './../../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss']
})
export class LayoutSelectorComponent implements OnInit, OnDestroy {

	user: IUser;
	componentLayouts = Object.values(ComponentLayoutStyleEnum);
	preferredComponentLayout: ComponentLayoutStyleEnum = ComponentLayoutStyleEnum.TABLE;

	constructor(
		private readonly store: Store,
		private readonly userService: UsersService
	) {}

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
				tap((preferredLayout: ComponentLayoutStyleEnum) => this.preferredComponentLayout = preferredLayout),
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
	 * Changed User Selected Preferred Component Layout
	 *
	 * @param payload
	 * @returns
	 */
	private async changePreferredComponentLayout(payload: IUserUpdateInput) {
		if (!this.user) {
			return;
		}
		try {
			await this.userService.updatePreferredComponentLayout(payload);
		} catch (error) {
			console.error(`Failed to update user preferred component layout`);
		}
	}

	ngOnDestroy(): void {}
}
