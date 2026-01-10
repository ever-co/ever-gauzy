import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { tap } from 'rxjs';

import { PluginPlanComparisonActions } from '../actions/plugin-plan-comparison.action';
import { PluginPlanComparisonStore } from '../stores/plugin-plan-comparison.store';

@Injectable({ providedIn: 'root' })
export class PluginPlanComparisonEffects {
  constructor(private readonly actions$: Actions, private readonly pluginPlanComparisonStore: PluginPlanComparisonStore) {}

  updatePlanComparison$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PluginPlanComparisonActions.updatePlanComparison),
      tap(({ comparison }) => {
        this.pluginPlanComparisonStore.updatePlanComparison(comparison);
      })
    )
  );

  resetPlanComparison$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PluginPlanComparisonActions.resetPlanComparison),
      tap(() => {
        this.pluginPlanComparisonStore.resetPlanComparison();
      })
    )
  );

  setConfirmationStep$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PluginPlanComparisonActions.setConfirmationStep),
      tap(({ step }) => {
        this.pluginPlanComparisonStore.setConfirmationStep(step);
      })
    )
  );
}
