import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';

export interface IPluginPlanState {
  plans: IPluginSubscriptionPlan[];
  selectedPlan: IPluginSubscriptionPlan | null;
  loading: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  error: string | null;

  currentPluginPlans: Record<string, IPluginSubscriptionPlan[]>;
}

export function createInitialPlanState(): IPluginPlanState {
  return {
    plans: [],
    selectedPlan: null,
    loading: false,
    creating: false,
    updating: false,
    deleting: false,
    error: null,
    currentPluginPlans: {}
  };
}

@StoreConfig({ name: '_plugin_plan' })
@Injectable({ providedIn: 'root' })
export class PluginPlanStore extends Store<IPluginPlanState> {
  constructor() {
    super(createInitialPlanState());
  }

  public setPlans(plans: IPluginSubscriptionPlan[]): void {
    const normalized = Array.isArray(plans) ? plans : [];
    this.update({ plans: normalized });
  }

  public addPlan(plan: IPluginSubscriptionPlan): void {
    this.update((state) => ({ plans: [plan, ...(state.plans || [])] }));
  }

  public updatePlan(planId: string, plan: IPluginSubscriptionPlan): void {
    this.update((state) => ({ plans: (state.plans || []).map((p) => (p.id === planId ? plan : p)) }));
  }

  public removePlan(planId: string): void {
    this.update((state) => ({ plans: (state.plans || []).filter((p) => p.id !== planId) }));
  }

  public selectPlan(plan: IPluginSubscriptionPlan | null): void {
    this.update({ selectedPlan: plan });
  }

  public setCurrentPluginPlans(pluginId: string, plans: IPluginSubscriptionPlan[]): void {
    this.update((state) => ({
      currentPluginPlans: {
        ...state.currentPluginPlans,
        [pluginId]: Array.isArray(plans) ? plans : []
      }
    }));
  }

  public setLoading(loading: boolean): void {
    this.update({ loading });
  }

  public setCreating(creating: boolean): void {
    this.update({ creating });
  }

  public setUpdating(updating: boolean): void {
    this.update({ updating });
  }

  public setDeleting(deleting: boolean): void {
    this.update({ deleting });
  }

  public setErrorMessage(error: string | null): void {
    this.update({ error });
  }

  public reset(): void {
    this.update({ plans: [], selectedPlan: null, currentPluginPlans: {} });
  }

  public resetError(): void {
    this.update({ error: null });
  }
}
