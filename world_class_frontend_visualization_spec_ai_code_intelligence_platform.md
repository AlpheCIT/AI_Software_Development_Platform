# World‑Class Frontend Visualization Spec (Graphin + Chakra UI)

**Product**: AI Code Intelligence Platform  
**Audience**: Frontend engineers, design, QA, DevOps  
**Goal**: Deliver a high‑performance, icon‑rich, drill‑down graph UI built with **Graphin (AntV G6)** and **Chakra UI**, optimized for your existing stack.

---

## 1) Core Decisions
- **Graph Renderer**: **Graphin (AntV G6)** — chosen for:
  - Built‑in **combos** (groups for services → modules → classes).
  - Rich **behaviors** (drag, zoom, expand, fitView, fisheye, activateRelations).
  - Excellent **layout algorithms** (force2, dagre, radial).
- **UI Framework**: **Chakra UI** — consistency with current stack, responsive, accessible by default.
- **Icons**: Custom **SVG icon set** (Lucide‑style line icons, scalable via CSS currentColor).

---

## 2) Icon Set (SVG)

| Type | Icon | File | Notes |
|------|------|------|-------|
| `service` | 🧩 | `icons/service.svg` | Cube/microservice
| `module` | 📦 | `icons/module.svg` | Box/package
| `class` | 🧱 | `icons/class.svg` | Brick/class
| `function` | ƒ | `icons/function.svg` | Script/function
| `api` | 🌐 | `icons/api.svg` | Globe/endpoint
| `database` | 🗄️ | `icons/database.svg` | Cylinder/DB
| `queue` | 📨 | `icons/queue.svg` | Queue/topic
| `infra` | 🏗️ | `icons/infra.svg` | Crane/infra
| `ci_job` | 🔁 | `icons/ci_job.svg` | CI pipeline loop
| `secret` | 🔒 | `icons/secret.svg` | Lock/secret
| `test` | ✅ | `icons/test.svg` | Checkmark/test

**Implementation:**  
- Store SVGs in `/public/icons/`.  
- Chakra `Icon` wrapper:
```tsx
import { createIcon } from "@chakra-ui/icons";

export const ServiceIcon = createIcon({
  displayName: 'ServiceIcon',
  viewBox: '0 0 24 24',
  path: (<path d="M3 3h18v18H3z" fill="currentColor" />)
});
```
- Provide `IconMapper.tsx`:
```ts
export const iconMapper: Record<string, any> = {
  service: ServiceIcon,
  module: ModuleIcon,
  class: ClassIcon,
  function: FunctionIcon,
  api: ApiIcon,
  database: DatabaseIcon,
  queue: QueueIcon,
  infra: InfraIcon,
  ci_job: CiJobIcon,
  secret: SecretIcon,
  test: TestIcon
};
```

---

## 3) Chakra Component Variants

### 3.1 Inspector Panel (Right Sidebar)
```tsx
<Box w="96" borderLeft="1px" borderColor="gray.200" bg="white">
  <Tabs variant="enclosed-colored">
    <TabList>
      <Tab>Overview</Tab>
      <Tab>Code</Tab>
      <Tab>Security</Tab>
      <Tab>Performance</Tab>
      <Tab>CI/CD</Tab>
      <Tab>Ownership</Tab>
      <Tab>History</Tab>
    </TabList>
    <TabPanels>
      <TabPanel>...</TabPanel>
    </TabPanels>
  </Tabs>
</Box>
```

### 3.2 Overlay Toggle Buttons
```tsx
<ButtonGroup size="sm" variant="outline">
  <Button leftIcon={<ShieldIcon />}>Security</Button>
  <Button leftIcon={<ZapIcon />}>Performance</Button>
  <Button leftIcon={<UsersIcon />}>Ownership</Button>
  <Button leftIcon={<PieChartIcon />}>Coverage</Button>
</ButtonGroup>
```

### 3.3 Graph Toolbar
```tsx
<HStack spacing={4} p={2} bg="gray.50" borderBottom="1px" borderColor="gray.200">
  <Input placeholder="Search nodes…" size="sm" />
  <Select size="sm">
    <option>Architecture</option>
    <option>Services</option>
    <option>Modules</option>
    <option>Classes/Functions</option>
    <option>CI/CD</option>
    <option>Infra</option>
  </Select>
  <IconButton aria-label="Save View" icon={<SaveIcon />} />
</HStack>
```

### 3.4 Node Tooltip
```tsx
<Tooltip
  label={
    <Box>
      <Text fontWeight="bold">{node.name}</Text>
      <Text fontSize="xs">{node.type} · {node.layer}</Text>
      <Text fontSize="xs" color="red.500">{node.security?.length ?? 0} issues</Text>
    </Box>
  }
  placement="top"
>
  <Box>{children}</Box>
</Tooltip>
```

---

## 4) Graphin Integration

### 4.1 Base Graph Component
```tsx
import Graphin, { Utils, Behaviors } from '@antv/graphin';

export default function GraphCanvas({ data }) {
  return (
    <Graphin data={data} layout={{ type: 'force2', preventOverlap: true }}>
      <Behaviors.ZoomCanvas />
      <Behaviors.DragCanvas />
      <Behaviors.DragNode />
      <Behaviors.ActivateRelations />
      <Behaviors.FitView />
    </Graphin>
  );
}
```

### 4.2 Node Styling Hook
```ts
export function useNodeStyle(node, overlay) {
  return {
    keyshape: {
      size: 28,
      fill: node.layer === 'frontend' ? '#e6f2ff'
        : node.layer === 'backend' ? '#effaf0'
        : node.layer === 'infra' ? '#fff3e8'
        : node.layer === 'ci_cd' ? '#f3e8ff'
        : '#f7f7f7',
      stroke: node.security?.some(s => s.severity === 'HIGH') ? '#cc0000' : '#888'
    },
    icon: {
      type: 'svg',
      value: iconMapper[node.type],
      size: 18
    },
    label: {
      value: node.name ?? node.id.split(':').pop(),
      fontSize: 10
    }
  };
}
```

---

## 5) Deliverables Checklist
- [ ] **SVG Icon Library**: `/public/icons/` with Chakra wrappers.
- [ ] **Graphin Adapter**: Node/edge style mappers.
- [ ] **Chakra Components**: InspectorPanel, Toolbars, Overlay toggles, Tooltips.
- [ ] **Pages**: Graph Explorer, Entity Detail, Compare/Diff, Saved Views.
- [ ] **State Management**: Zustand store with mode, overlay, filters.
- [ ] **API Contracts**: GraphPayload + Insights endpoints wired via React Query.
- [ ] **Tests**: Unit (style mappers), Component (panel/toolbars), E2E (Playwright expand, filter, save view).

---

## 6) Next Steps
1. Build **IconMapper** with initial SVG set.
2. Scaffold **GraphCanvas** with Graphin + sample data.
3. Wire **InspectorPanel** and overlay toggles using Chakra.
4. Implement **streaming neighborhood fetch** from `/api/graph/neighborhood`.
5. Add **semantic zoom rules** with Graphin’s layout engine.

---

✅ This locks the renderer choice to **Graphin** and defines a **Chakra UI kit + SVG icons** so the frontend team has everything needed to implement the visualization layer consistently.



---

# Addendum A — Renderer Lock & UI Kit Implementation

**Renderer locked:** **Graphin (AntV G6)**  
**UI kit:** **Chakra UI**  
**Status:** Ready for implementation

## A.1 Why Graphin (G6)
- Combos & behaviors out of the box (collapse/expand groups, activate relations, fisheye, mini‑map)
- Rich layouts (force2, dagre, radial) and performant WebGL/canvas rendering
- Mature plugin ecosystem and TypeScript support

> If we ever need to swap to **Sigma.js**, the render layer is abstracted via a `GraphRenderer` interface so we can plug a Sigma adapter without rewriting business logic.

## A.2 Packages to Install
```bash
# graph renderer
pnpm add @antv/graphin @antv/graphin-components @antv/g6

# ui kit + deps
pnpm add @chakra-ui/react @emotion/react @emotion/styled framer-motion

# app state & data fetching
pnpm add zustand @tanstack/react-query

# types (if needed)
pnpm add -D @types/node @types/react @types/react-dom
```

## A.3 File Layout (frontend)
```
apps/web-dashboard/
  src/
    renderer/           # render abstraction + Graphin adapter
      GraphRenderer.ts  # interface
      GraphinRenderer.tsx
      nodeStyles.ts
      edgeStyles.ts
    components/
      graph/
        GraphCanvas.tsx
        GraphToolbars.tsx
        MiniMapPanel.tsx
        Inspector.tsx
      ui-kit/
        icons/          # svg sprite + React wrappers
          icons.svg
          index.tsx
        theme/
          index.ts       # theme extension
          tokens.ts      # colors, sizes, radii
          components.ts  # component variants (Badge, Tag, Card, Tabs, Tooltip)
    pages/
      GraphPage.tsx
```

## A.4 Renderer Abstraction & Graphin Adapter
```ts
// renderer/GraphRenderer.ts
import type { GraphNode, GraphEdge, GraphPayload } from '@/types/graph';

export interface GraphRendererProps {
  data: GraphPayload;
  mode: 'architecture'|'service'|'module'|'class'|'function'|'ci'|'infra';
  overlay?: 'security'|'performance'|'quality'|'ownership'|'coverage';
  onSelect?: (nodeId?: string) => void;
  onExpand?: (nodeId: string) => void;
}

export interface GraphRenderer {
  render: (props: GraphRendererProps) => JSX.Element;
}
```
```tsx
// renderer/GraphinRenderer.tsx
import React, { useMemo } from 'react';
import Graphin, { Behaviors, Utils } from '@antv/graphin';
import type { GraphNode, GraphEdge, GraphPayload } from '@/types/graph';
import { nodeConfig } from './nodeStyles';
import { edgeConfig } from './edgeStyles';

function toGraphin(payload: GraphPayload){
  const nodes = payload.nodes.map(n => ({ id: n.id, data: n, ...nodeConfig(n) }));
  const edges = payload.edges.map(e => ({ source: e.source, target: e.target, data: e, ...edgeConfig(e) }));
  return { nodes: Utils.uniqueElements(nodes, 'id'), edges };
}

export default function GraphinRenderer({ data, onSelect, onExpand }: any){
  const graphData = useMemo(() => toGraphin(data), [data]);
  return (
    <Graphin data={graphData} layout={{ type: 'force2', preventOverlap: true }}>
      <Behaviors.ZoomCanvas />
      <Behaviors.DragCanvas />
      <Behaviors.DragNode />
      <Behaviors.ActivateRelations />
      <Behaviors.FitView />
      <Behaviors.ClickSelect onChange={(n:any)=>{ const id=n?.nodes?.[0]?.id; if(id){ onSelect?.(id); onExpand?.(id);} }} />
    </Graphin>
  );
}
```

## A.5 Node/Edge Styles bound to Chakra Tokens
```ts
// renderer/nodeStyles.ts
import type { GraphNode } from '@/types/graph';
import { layerColors } from '@/components/ui-kit/theme/tokens';
import { typeIcon } from '@/components/ui-kit/icons';

export function nodeConfig(n: GraphNode){
  const fill = layerColors[n.layer ?? 'default'];
  const border = (n.security?.some(s => ['HIGH','CRITICAL'].includes(s.severity))) ? '#cc0000' : '#888';
  return {
    label: n.name ?? n.id.split(':').pop(),
    style: {
      keyshape: { size: 28, fill, stroke: border, lineWidth: 1.25, radius: 8 },
      icon: { type: 'text', value: typeIcon[n.type] ?? '•', size: 16 },
      label: { fontSize: 10 }
    }
  } as const;
}
```
```ts
// renderer/edgeStyles.ts
import type { GraphEdge } from '@/types/graph';
export function edgeConfig(e: GraphEdge){
  return { style: { endArrow: true, lineDash: e.kind==='imports' ? [4,4] : undefined }, label: e.label } as const;
}
```

## A.6 Graph Canvas & Page Wiring
```tsx
// components/graph/GraphCanvas.tsx
import React from 'react';
import GraphinRenderer from '@/renderer/GraphinRenderer';
export default function GraphCanvas(props:any){ return <GraphinRenderer {...props} />; }
```
```tsx
// pages/GraphPage.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import GraphCanvas from '@/components/graph/GraphCanvas';
import Inspector from '@/components/graph/Inspector';
import { TopBar } from '@/components/graph/GraphToolbars';

export default function GraphPage(){
  const { data } = useQuery({ queryKey:['seed'], queryFn:()=>fetch('/api/graph/seeds?limit=200').then(r=>r.json()) });
  const [selected, setSelected] = React.useState<string|undefined>();
  return (
    <div className="flex h-full">
      <div className="flex-1">
        <TopBar />
        {data && (
          <GraphCanvas data={data} onSelect={setSelected} onExpand={(id)=>{/* fetch neighborhood */}} />
        )}
      </div>
      <Inspector nodeId={selected} />
    </div>
  );
}
```

## A.7 Chakra UI Kit — Theme & Components
```ts
// components/ui-kit/theme/tokens.ts
export const colors = {
  layer: {
    frontend: '#e6f2ff', backend: '#effaf0', infra: '#fff3e8', ci_cd: '#f3e8ff', default: '#f7f7f7'
  },
  severity: { LOW:'#6bbf59', MEDIUM:'#f0ad4e', HIGH:'#e67e22', CRITICAL:'#cc0000' }
};
export const layerColors = colors.layer;
export const severityColor = (s:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL') => colors.severity[s];
```
```ts
// components/ui-kit/theme/index.ts
import { extendTheme } from '@chakra-ui/react';
export const theme = extendTheme({
  styles:{global:{'html, body':{bg:'gray.50'}}},
  components:{
    Badge:{ variants:{ severity:(props:any)=>({
      bg:`${props.colorScheme}.100`, color:`${props.colorScheme}.800`, borderRadius:'md', px:2
    })}},
    Card:{ baseStyle:{ container:{ borderRadius:'2xl', boxShadow:'md' } } },
    Tabs:{ baseStyle:{ tab:{ _selected:{ color:'teal.600', borderColor:'teal.600'} } } },
    Tooltip:{ baseStyle:{ borderRadius:'md', boxShadow:'lg' } }
  }
});
```
```tsx
// components/ui-kit/icons/index.tsx
export const typeIcon: Record<string,string> = {
  service:'🧩', module:'📦', class:'🧱', function:'ƒ', api:'🌐', database:'🗄️', queue:'📨', infra:'🏗️', ci_job:'🔁', secret:'🔒', test:'✅'
};
```
```tsx
// components/ui-kit/CoverageRing.tsx
export function CoverageRing({ value=0.8, size=24 }:{value:number; size?:number}){
  const pct = Math.round(value*100);
  const style = { width:size, height:size, borderRadius:'50%', background:`conic-gradient(#3182ce ${pct}%, #edf2f7 0)` } as const;
  return <div style={style} aria-label={`Coverage ${pct}%`} />;
}
```
```tsx
// components/ui-kit/SeverityPill.tsx
import { Badge } from '@chakra-ui/react';
export function SeverityPill({ level }:{ level:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' }){
  const scheme = level==='LOW'?'green':level==='MEDIUM'?'orange':level==='HIGH'?'red':'red';
  return <Badge variant="severity" colorScheme={scheme}>{level}</Badge>;
}
```

## A.8 WebSocket Live Updates (Graph Events)
```ts
const ws = new WebSocket(import.meta.env.VITE_WS_BASE + '/ws/graph');
ws.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  switch(evt.type){
    case 'node.updated': /* merge node */ break;
    case 'edge.added': /* add edge */ break;
    case 'insight.updated': /* recompute overlay styles */ break;
  }
};
```

## A.9 Acceptance Tests (Playwright)
- Expand node → neighborhood fetched → inspector opens
- Toggle overlays (security/perf); halos/badges adjust
- Save & share view; open read‑only permalink
- CI/CD mode → pipeline DAG with durations renders
- Infra mode → namespaces grouped as combos

> This addendum concretizes renderer choice and ships a minimal UI kit your team can paste into the repo to get a functional, themed graph UI running quickly.

