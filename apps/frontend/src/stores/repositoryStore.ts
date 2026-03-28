import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Repository {
  id: string;
  url: string;
  name: string;
  defaultBranch: string;
  lastAnalyzed?: string;
  totalRuns?: number;
}

export interface Branch {
  id: string;
  name: string;
  commitHash?: string;
  lastAnalyzed?: string;
}

interface RepositoryState {
  repositories: Repository[];
  selectedRepositoryId: string | null;
  selectedBranch: string | null;
  branches: Branch[];

  setRepositories: (repos: Repository[]) => void;
  selectRepository: (repoId: string) => void;
  selectBranch: (branch: string) => void;
  setBranches: (branches: Branch[]) => void;
  getSelectedRepository: () => Repository | undefined;
}

export const useRepositoryStore = create<RepositoryState>()(
  persist(
    (set, get) => ({
      repositories: [],
      selectedRepositoryId: null,
      selectedBranch: null,
      branches: [],

      setRepositories: (repos) => set({ repositories: repos }),
      selectRepository: (repoId) => set({ selectedRepositoryId: repoId, selectedBranch: null }),
      selectBranch: (branch) => set({ selectedBranch: branch }),
      setBranches: (branches) => set({ branches }),
      getSelectedRepository: () => get().repositories.find(r => r.id === get().selectedRepositoryId)
    }),
    { name: 'repository-selection' }
  )
);
