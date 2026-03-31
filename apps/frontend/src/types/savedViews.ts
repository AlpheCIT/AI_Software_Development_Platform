// Saved views types and store
export interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  selectedNodeIds: string[];
  activeLayers: string[];
  activeOverlays: string[];
  searchQuery?: string;
  description?: string;
}

export interface SavedViewsState {
  views: SavedView[];
  currentView?: string;
}

export interface SavedViewsActions {
  load: () => void;
  save: (view: Omit<SavedView, 'id' | 'createdAt'>) => void;
  update: (id: string, updates: Partial<SavedView>) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  clear: () => void;
  export: () => string;
  import: (data: string) => void;
}

