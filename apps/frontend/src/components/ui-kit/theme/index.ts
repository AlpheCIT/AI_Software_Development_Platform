import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  styles: {
    global: {
      'html, body': {
        bg: 'gray.50'
      }
    }
  },
  components: {
    Badge: {
      variants: {
        severity: (props: any) => ({
          bg: `${props.colorScheme}.100`,
          color: `${props.colorScheme}.800`,
          borderRadius: 'md',
          px: 2
        })
      }
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: '2xl',
          boxShadow: 'md'
        }
      }
    },
    Tabs: {
      baseStyle: {
        tab: {
          _selected: {
            color: 'teal.600',
            borderColor: 'teal.600'
          }
        }
      }
    },
    Tooltip: {
      baseStyle: {
        borderRadius: 'md',
        boxShadow: 'lg'
      }
    },
    Button: {
      variants: {
        graph: {
          size: 'sm',
          variant: 'outline',
          borderRadius: 'md'
        }
      }
    }
  },
  colors: {
    layer: {
      frontend: '#e6f2ff',
      backend: '#effaf0',
      infra: '#fff3e8',
      ci_cd: '#f3e8ff',
      default: '#f7f7f7'
    },
    severity: {
      50: '#f0fff4',
      100: '#c6f6d5',
      200: '#9ae6b4',
      300: '#68d391',
      400: '#48bb78',
      500: '#38a169',
      600: '#2f855a',
      700: '#276749',
      800: '#22543d',
      900: '#1a202c'
    }
  }
});
