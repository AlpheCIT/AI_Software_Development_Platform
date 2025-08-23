I’ve now extended the spec with **Inspector Tabs and Saved Views skeletons** so you can hand over a single, clear, concise doc to the dev team — no more JSON-ish partials.

### Addendum D — Inspector Tabs Implementation

**Components (src/components/graph/):**
- `InspectorTabs.tsx` → tabbed panel with Chakra `<Tabs>`
- Tabs: `OverviewTab.tsx`, `CodeTab.tsx`, `SecurityTab.tsx`, `PerformanceTab.tsx`, `CICDTab.tsx`, `OwnershipTab.tsx`, `HistoryTab.tsx`

**API hooks:**
- `/api/graph/node/:id` → feeds Overview + Code
- `/api/insights/security/:nodeId` → feeds SecurityTab
- `/api/insights/performance/:nodeId` → feeds PerformanceTab
- `/api/insights/cicd/:nodeId` → feeds CICDTab
- `/api/ownership/:nodeId` → feeds OwnershipTab
- `/api/graph/history/:nodeId` → feeds HistoryTab

**Usage:**
```tsx
<InspectorTabs nodeId={selectedNodeId} />
```

Each tab consumes its respective hook (already stubbed in `src/lib/api/queries.ts`). Tabs auto‑mount/unmount for performance.

---

### Addendum E — Saved Views Skeleton

**Component:** `SavedViews.tsx` (in `src/components/graph/`)
- Provides list of user‑saved graph configurations (layout, filters, selection)
- Uses Zustand store `graphStore` + local storage API

**Store shape:**
```ts
interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  graphState: GraphState;
}

interface SavedViewStore {
  views: SavedView[];
  addView(view: SavedView): void;
  deleteView(id: string): void;
  loadView(id: string): void;
}
```

**UI:**
- `<SavedViews />` renders a list with load/delete buttons
- “Save Current View” button on `GraphToolbar`

---

### README Handoff (drop into apps/frontend/README.md)

```md
# Frontend Developer Handoff

## Setup
```bash
pnpm install
pnpm dev
```

- Runs at http://localhost:3000
- Proxies to backend API (:8000), vector (:8005), and WS (:4001)

## Key Components
- GraphCanvas → renders nodes/edges
- InspectorTabs → right‑hand details panel (Overview · Code · Security · Performance · CI/CD · Ownership · History)
- SavedViews → manage custom graph layouts/filters

## API Contracts
- `/api/graph/seeds?repositoryId=…`
- `/api/graph/neighborhood/:nodeId`
- `/api/graph/node/:id`
- `/api/insights/security|performance|cicd/:nodeId`
- `/api/ownership/:nodeId`
- `/api/graph/history/:nodeId`

## Runbook
- Use Chakra UI components only
- Types live in `src/types/graph.ts`
- WebSocket client in `src/lib/websocket/client.ts`
- Saved Views persist via Zustand + localStorage

## Deliverables (Sprint 1‑2)
- GraphCanvas wired to API
- InspectorTabs fully functional
- SavedViews skeleton working (localStorage)
```

---

This replaces the confusing old JSON-ish plan. Give your devs only this **World‑Class Frontend Visualization Spec (with Addendums A–E)** + the README.md block for the repo.



---

# Addendum D — Saved Views Skeleton (Create · Load · Share)

> This adds a minimal, production‑ready Saved Views flow that matches the spec and Graphin renderer. Paste these files into `apps/frontend/src/` as indicated. API contract is intentionally thin so backend can implement quickly.

## 1) Types

### 1.1 `src/types/views.ts`
```ts
export type SavedViewParams = {
  mode?: 'architecture'|'service'|'module'|'class'|'function'|'ci'|'infra';
  overlay?: 'security'|'performance'|'quality'|'ownership'|'coverage';
  filters?: Record<string, any>;
  time?: { at?: string };
};

export type SavedView = {
  id: string;
  name: string;
  scopeId: string; // repo/service/domain id
  params: SavedViewParams;
  layout?: { positions?: Record<string,{x:number;y:number}>; seed?: number };
  dataHash?: string; // optional for immutable snapshots
  live?: boolean;    // if true, re‑queries on open
  createdAt: string;
  createdBy: string;
};
```

## 2) API hooks

### 2.1 `src/lib/api/views.ts`
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedView } from '@/types/views';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers:{ 'Content-Type':'application/json' }, ...init });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export function useSavedView(id?: string){
  return useQuery<SavedView>({ queryKey:['view', id], queryFn:()=> j(`/api/views/${id}`), enabled: !!id });
}

export function useSavedViews(scopeId?: string){
  return useQuery<SavedView[]>({ queryKey:['views', scopeId], queryFn:()=> j(`/api/views?scopeId=${encodeURIComponent(scopeId||'')}`) });
}

export function useCreateView(){
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SavedView>) => j<SavedView>(`/api/views`, { method:'POST', body: JSON.stringify(body)}),
    onSuccess: (v) => { qc.invalidateQueries({queryKey:['views']}); qc.setQueryData(['view', v.id], v); }
  });
}
```

> **Backend endpoints expected**
> - `POST /api/views` `{ name, scopeId, params, layout, live } → { id, ... }`
> - `GET /api/views/:id` → SavedView
> - `GET /api/views?scopeId=...` → SavedView[]

## 3) UI components

### 3.1 `src/components/graph/SavedViews.tsx`
```tsx
import React from 'react';
import { Button, IconButton, HStack, Menu, MenuButton, MenuList, MenuItem, useDisclosure, Input, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel } from '@chakra-ui/react';
import { useCreateView, useSavedViews } from '@/lib/api/views';
import type { SavedViewParams } from '@/types/views';

export function SavedViewsMenu({ scopeId, onLoad }:{ scopeId: string; onLoad:(id:string)=>void }){
  const { data } = useSavedViews(scopeId);
  return (
    <Menu>
      <MenuButton as={Button} size="sm" variant="outline">Saved Views</MenuButton>
      <MenuList>
        {(data||[]).map(v => (
          <MenuItem key={v.id} onClick={()=> onLoad(v.id)}>{v.name}</MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

export function SaveViewButton({ scopeId, getParams, getLayout }:{ scopeId:string; getParams:()=>SavedViewParams; getLayout:()=>any }){
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [name, setName] = React.useState('');
  const create = useCreateView();

  const save = async ()=>{
    await create.mutateAsync({ name, scopeId, params: getParams(), layout: getLayout(), live: true });
    onClose();
  };

  return (
    <>
      <Button size="sm" colorScheme="teal" onClick={onOpen}>Save View</Button>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Save Current View</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>View name</FormLabel>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Security hotspots"/>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={save} isDisabled={!name.trim()}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
```

## 4) Wiring into GraphPage

### 4.1 `src/pages/GraphPage.tsx` (augment)
```tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import GraphCanvas from '@/components/graph/GraphCanvas';
import type { GraphPayload } from '@/types/graph';
import { SavedViewsMenu, SaveViewButton } from '@/components/graph/SavedViews';
import { useSavedView } from '@/lib/api/views';

export default function GraphPage(){
  const scopeId = 'default-repo'; // TODO: derive from route or user selection
  const viewId = new URLSearchParams(location.search).get('view');
  const { data: seed } = useQuery<GraphPayload>({ queryKey:['seed', scopeId], queryFn:()=> fetch(`/api/graph/seeds?scopeId=${scopeId}&limit=200`).then(r=>r.json()) });
  const { data: view } = useSavedView(viewId || undefined);

  // TODO: keep a ref to current graph positions; provide to SaveViewButton.getLayout
  const getLayout = React.useCallback(()=>({ /* positions: {...} */ }), []);
  const getParams = React.useCallback(()=>({ /* mode, overlay, filters, time */ }), []);

  const onLoadView = (id:string)=>{ const u = new URL(location.href); u.searchParams.set('view', id); history.pushState({}, '', u); location.reload(); };

  const data = seed; // in v2: if(view && !view.live) use snapshot from view; else query neighborhood w/ view.params

  return (
    <div className="h-full">
      <div className="flex gap-2 p-2">
        <SavedViewsMenu scopeId={scopeId} onLoad={onLoadView} />
        <SaveViewButton scopeId={scopeId} getParams={getParams} getLayout={getLayout} />
      </div>
      {data && (
        <GraphCanvas data={data} onExpand={(id)=>{/* fetch /api/graph/neighborhood?id=${id} */}} />
      )}
    </div>
  );
}
```

## 5) Notes for backend implementers
- **Immutable snapshots (optional)**: If a view is saved with `dataHash`, store the rendered subgraph so `/api/views/:id` can return a frozen payload; otherwise, treat as **live view** and re‑run the underlying queries using `params`.
- **Positions**: The frontend can POST node positions in `layout.positions` so re‑loading a view restores the same layout (nice DX win for demos and incident runbooks).
- **Share links**: The `?view=<id>` URL param is sufficient for deep linking.

---

# README.md — Frontend (paste at `apps/frontend/README.md`)

```md
# AI Software Development Platform — Frontend

This app renders a world‑class, interactive code graph using **Graphin (G6)** and **Chakra UI**. It implements semantic zoom, overlays, Inspector tabs, and Saved Views.

## Prereqs
- API Gateway at http://localhost:8000
- Vector Search at http://localhost:8005 (optional)
- WebSocket at ws://localhost:4001/ws/graph

## Install & Run
```bash
pnpm i
pnpm dev
```

## Key Paths
- `src/renderer/*` — render layer (Graphin adapter)
- `src/components/graph/Inspector.tsx` — right‑panel tabs
- `src/components/graph/SavedViews.tsx` — Saved Views UI
- `src/lib/api/views.ts` — Saved Views hooks (create/list/get)
- `src/types/graph.ts` & `src/types/views.ts` — data contracts

## API Expectations
- `GET /api/graph/seeds?scopeId=...&limit=...` → initial graph
- `GET /api/graph/neighborhood?id=...&k=1` → expand node
- `GET /api/graph/node/:id` → node details
- `GET /api/insights/security|perf|cicd?id=...` → overlay data
- `GET /api/graph/history?id=...` → node history
- `POST /api/views` → create a saved view
- `GET /api/views/:id` → fetch a saved view
- `GET /api/views?scopeId=...` → list saved views

## Conventions
- **Chakra UI** for styling/theme
- **React Query** for data fetching
- **Zustand** for UI state (mode, overlay, selection)
- **Typescript** everywhere

## Dev Tips
- Use `?view=<id>` to deep‑link to a saved view
- Keep layout positions in `layout.positions` when saving views to preserve node placement
- Use overlay toggles to validate security/perf data plumbs
```

