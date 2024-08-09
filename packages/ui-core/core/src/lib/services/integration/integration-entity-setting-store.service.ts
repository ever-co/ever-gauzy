import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { clone } from 'underscore';
import {
    IEntitySettingToSync,
    IIntegrationEntitySetting,
    IIntegrationTenant,
    IntegrationEntity
} from '@gauzy/contracts';

export interface IJobMatchingEntity {
    previousValue: IIntegrationEntitySetting | null;
    currentValue: IIntegrationEntitySetting | null;
}

@UntilDestroy()
@Injectable({
    providedIn: 'root'
})
export class IntegrationEntitySettingServiceStoreService {
    // Declare a private BehaviorSubject named '_jobMatchingEntity$' with an initial value.
    // This BehaviorSubject will hold and emit the current state of job matching entity settings synchronization.
    private _jobMatchingEntity$ = new BehaviorSubject<IJobMatchingEntity>({
        previousValue: null,
        currentValue: null
    });
    public jobMatchingEntity$: Observable<IJobMatchingEntity> = this._jobMatchingEntity$.asObservable();

    // Declare a private BehaviorSubject named '_entitiesToSync$' with an initial value.
    // This BehaviorSubject will hold and emit the current state of entity settings synchronization.
    private _entitiesToSync$: BehaviorSubject<IEntitySettingToSync> = new BehaviorSubject({
        previousValue: [],
        currentValue: [],
    });
    // Declare a public Observable named 'entitiesToSync$' that exposes the data from '_entitiesToSync$'.
    public entitiesToSync$: Observable<IEntitySettingToSync> = this._entitiesToSync$.asObservable();

    constructor() { }

    /**
     * Create an IEntitySettingToSync object based on the provided items.
     * @param items - An array of IIntegrationEntitySetting items.
     * @returns An IEntitySettingToSync object containing previous and current values.
     */
    public setEntitySettingsValue(items: IIntegrationEntitySetting[]): void {
        // Create an IEntitySettingToSync object
        this._entitiesToSync$.next({
            previousValue: clone(items), // Clone the input items as the previous value
            currentValue: items, // Set the input items as the current value
        });
    }

    /**
     * Get the current value of entity settings synchronization.
     * @returns The current value as an IEntitySettingToSync object.
     */
    public getEntitySettingsValue(): IEntitySettingToSync {
        // Use the 'getValue' method of '_entitiesToSync$' to retrieve the current value
        return this._entitiesToSync$.getValue();
    }

    /**
     * Sets the job matching entity state in the IntegrationEntitySettingServiceStoreService.
     * This function takes a new job matching entity setting and updates the internal state.
     *
     * @param newEntity - The new job matching entity setting to be set. It represents the updated state for job matching entities.
     */
    public setJobMatchingEntity(newEntity: IIntegrationEntitySetting): void {
        // Retrieve the current value from the '_jobMatchingEntity$' BehaviorSubject
        const { currentValue } = this._jobMatchingEntity$.getValue();

        // Update the job matching entity state using 'next' on the BehaviorSubject
        this._jobMatchingEntity$.next({
            previousValue: currentValue,
            currentValue: newEntity
        });
    }

    /**
     * Updates the AI job matching entity setting in IntegrationEntitySettingServiceStoreService
     * based on the provided integration stream.
     *
     * @param integration$ - An Observable stream of IIntegrationTenant representing the integration data.
     * @returns An Observable stream of IIntegrationEntitySetting representing the updated AI job matching entity setting.
     */
    updateAIJobMatchingEntity(integration$: Observable<IIntegrationTenant>): Observable<IIntegrationEntitySetting> {
        return integration$.pipe(
            tap((integration: IIntegrationTenant) => {
                if (!integration) {
                    // If integration is falsy, set a default entity setting and exit the function
                    this.setJobMatchingEntity({ entity: IntegrationEntity.JOB_MATCHING, sync: false, isActive: false });
                    return;
                }
            }),
            // Extracting the 'entitySettings' property from the 'integration_tenant' object
            filter((integration: IIntegrationTenant) => !!integration && !!integration.isActive),
            // Maps the integration to its 'entitySettings' property
            map((integration: IIntegrationTenant) => integration.entitySettings),
            // Finding the entity setting related to the specified entity type
            map((entitySettings: IIntegrationEntitySetting[]) =>
                entitySettings.find((setting: IIntegrationEntitySetting) => setting.entity === IntegrationEntity.JOB_MATCHING)
            ),
            filter((entity: IIntegrationEntitySetting) => !!entity),
            // Updating the specified component property with the fetched entity setting
            tap((entity: IIntegrationEntitySetting) => this.setJobMatchingEntity(entity)),
            // Handling the component lifecycle to avoid memory leaks
            untilDestroyed(this)
        );
    }
}
