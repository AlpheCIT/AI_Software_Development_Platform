import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text, Button, VStack, Alert, AlertIcon } from '@chakra-ui/react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          minHeight="100vh"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="gray.50"
          p={8}
        >
          <Box maxWidth="md" width="100%">
            <Alert status="error" borderRadius="lg" p={6}>
              <AlertIcon boxSize={6} />
              <VStack align="stretch" spacing={4} width="100%">
                <Box>
                  <Text fontSize="lg" fontWeight="bold">
                    Something went wrong
                  </Text>
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    The application encountered an unexpected error. Please try reloading the page.
                  </Text>
                </Box>

                {this.state.error && (
                  <Box
                    bg="red.50"
                    p={4}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="red.200"
                  >
                    <Text fontSize="sm" fontFamily="mono" color="red.800">
                      {this.state.error.message}
                    </Text>
                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                      <Box mt={2}>
                        <Text fontSize="xs" color="red.600" fontFamily="mono">
                          {this.state.errorInfo.componentStack}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )}

                <Box>
                  <Button colorScheme="blue" onClick={this.handleReload} mr={3}>
                    Reload Page
                  </Button>
                  <Button variant="outline" onClick={this.handleReset}>
                    Try Again
                  </Button>
                </Box>
              </VStack>
            </Alert>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}