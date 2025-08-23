import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedView, SavedViewsState, SavedViewsActions } from '../types/savedViews';

const STORAGE_KEY = 'ai-platform-saved-views';

type SavedViewsStore = SavedViewsState & { actions: SavedViewsActions };

export const useSavedViewsStore = create<SavedViewsStore>()(
  persist(
    (set, get) => ({
      // State
      views: [],
      currentView: undefined,

      // Actions
      actions: {
        load: () => {
          // This is handled automatically by the persist middleware
          // But we can add custom logic here if needed
        },

        save: (viewData) => {
          const newView: SavedView = {
            ...viewData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            views: [...state.views, newView],
            currentView: newView.id,
          }));

          return newView.id;
        },

        update: (id, updates) => {
          set((state) => ({
            views: state.views.map((view) =>
              view.id === id ? { ...view, ...updates } : view
            ),
          }));
        },

        remove: (id) => {
          set((state) => ({
            views: state.views.filter((view) => view.id !== id),
            currentView: state.currentView === id ? undefined : state.currentView,
          }));
        },

        select: (id) => {
          const view = get().views.find((v) => v.id === id);
          if (view) {
            set({ currentView: id });
          }
        },

        clear: () => {
          set({ views: [], currentView: undefined });
        },

        export: () => {
          const { views } = get();
          return JSON.stringify(views, null, 2);
        },

        import: (data) => {
          try {
            const importedViews = JSON.parse(data) as SavedView[];
            
            // Validate the imported data
            if (!Array.isArray(importedViews)) {
              throw new Error('Invalid data format');
            }

            // Regenerate IDs to avoid conflicts
            const viewsWithNewIds = importedViews.map((view) => ({
              ...view,
              id: crypto.randomUUID(),
            }));

            set((state) => ({
              views: [...state.views, ...viewsWithNewIds],
            }));
          } catch (error) {
            console.error('Failed to import saved views:', error);
            throw new Error('Failed to import saved views');
          }
        },
      },
    }),
    {
      name: STORAGE_KEY,
      // Only persist the views and currentView, not the actions
      partialize: (state) => ({
        views: state.views,
        currentView: state.currentView,
      }),
    }
  )
);

// Convenience hooks for easier usage
export const useSavedViews = () => {
  const views = useSavedViewsStore((state) => state.views);
  const currentView = useSavedViewsStore((state) => state.currentView);
  const actions = useSavedViewsStore((state) => state.actions);

  return {
    views,
    currentView,
    ...actions,
  };
};

export const useCurrentView = () => {
  const views = useSavedViewsStore((state) => state.views);
  const currentViewId = useSavedViewsStore((state) => state.currentView);
  
  return currentViewId ? views.find((v) => v.id === currentViewId) : undefined;
};
