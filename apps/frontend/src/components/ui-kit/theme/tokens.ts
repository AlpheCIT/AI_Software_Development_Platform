// Theme tokens and colors
export const colors = {
  layer: {
    frontend: '#e6f2ff',
    backend: '#effaf0', 
    infra: '#fff3e8',
    ci_cd: '#f3e8ff',
    default: '#f7f7f7'
  },
  severity: {
    LOW: '#6bbf59',
    MEDIUM: '#f0ad4e', 
    HIGH: '#e67e22',
    CRITICAL: '#cc0000'
  }
};

export const layerColors = colors.layer;

export const severityColor = (s: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => colors.severity[s];

// Size tokens
export const sizes = {
  node: {
    small: 20,
    medium: 28,
    large: 36
  },
  icon: {
    small: 14,
    medium: 18,
    large: 24
  }
};

// Spacing tokens
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem'
};

// Border radius tokens
export const radii = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px'
};