# @gauzy/ui-react-bridge

Bridge for rendering React components inside Angular with access to Angular services via React Context.

Uses the React Context + `createRoot` approach to embed React in Angular (see [Netanel Basal's article](https://netbasal.com/using-react-in-angular-applications-1bb907ecac91) for the underlying technique).

## Installation

```bash
yarn add react react-dom
# @gauzy/ui-react-bridge is a workspace package
```

## Usage

### 1. Import directives in your Angular module

```ts
import { ReactComponentDirective, LazyReactDirective } from '@gauzy/ui-react-bridge';

@NgModule({
  imports: [ReactComponentDirective, LazyReactDirective, ...],
})
export class AppModule {}
```

### 2. Render a React component (eager)

```html
<div [gzReactHost]="MyReactComponent" [props]="props"></div>
```

With extra context:

```html
<div [gzReactHost]="KanbanBoard" [props]="props" [context]="{ pageTitle: 'Kanban' }"></div>
```

### 3. Render a React component (lazy / code-split)

```html
<div [gzReactLazyHost]="loadKanban" [props]="kanbanProps" [context]="{ pageTitle: 'Kanban' }"></div>
```

```ts
loadKanban = () => import('./kanban/KanbanBoard').then((m) => m);
kanbanProps = { columns: this.columns };
```

### 4. Access Angular services in React

```tsx
import { useInjector } from '@gauzy/ui-react-bridge';
import { Router } from '@angular/router';

export function MyReactComponent() {
	const router = useInjector(Router);
	return <button onClick={() => router.navigate(['/home'])}>Go Home</button>;
}
```

Or get the Injector for multiple lookups:

```tsx
const injector = useInjector();
const router = injector.get(Router);
const http = injector.get(HttpClient);
```

### 5. Access extra context

```tsx
import { useBridgeContext } from '@gauzy/ui-react-bridge';

export function MyReactComponent() {
	const { injector, pageTitle } = useBridgeContext();
	// pageTitle came from [context]="{ pageTitle: 'Kanban' }"
	return <h1>{pageTitle}</h1>;
}
```

## API

| Export                    | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `ReactComponentDirective` | Directive `[gzReactHost]` – eager render                       |
| `LazyReactDirective`      | Directive `[gzReactLazyHost]` – lazy render via dynamic import |
| `useInjector()`           | Returns Angular `Injector`                                     |
| `useInjector(MyService)`  | Returns injected service                                       |
| `useBridgeContext()`      | Returns full context (injector + context)                      |
| `NgContextProvider`       | React context provider (used internally)                       |
| `NgReactBridgeContext`    | Context type                                                   |
