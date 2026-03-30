import React from 'react';
import { Alert, AlertIcon, AlertTitle, AlertDescription, Box } from '@chakra-ui/react';

interface Props { children: React.ReactNode; fallbackTitle?: string; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>{this.props.fallbackTitle || 'Render Error'}</AlertTitle>
            <AlertDescription fontSize="sm">{this.state.error?.message}</AlertDescription>
          </Box>
        </Alert>
      );
    }
    return this.props.children;
  }
}
