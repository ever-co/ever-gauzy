import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { clone } from 'underscore';
import { IEntitySettingToSync, IIntegrationEntitySetting } from '@gauzy/contracts';

export interface IJobMatchingEntity {
    previousValue: IIntegrationEntitySetting | null;
    currentValue: IIntegrationEntitySetting | null;
}

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
}
