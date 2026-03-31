import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Box,
  Badge,
  IconButton,
  Alert,
  AlertIcon,
  Divider
} from '@chakra-ui/react';
import { Save, Download, Upload, Trash2 } from 'lucide-react';

export default function SavedViews() {
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState([
    {
      id: 'view-1',
      name: 'Security Overview',
      description: 'All services with security issues',
      createdAt: '2025-08-21T10:00:00Z',
      nodeCount: 25,
      mode: 'architecture'
    },
    {
      id: 'view-2', 
      name: 'Performance Issues',
      description: 'Services with performance problems',
      createdAt: '2025-08-20T15:30:00Z',
      nodeCount: 12,
      mode: 'service'
    }
  ]);

  const handleSaveCurrentView = () => {
    if (!viewName.trim()) return;

    const newView = {
      id: `view-${Date.now()}`,
      name: viewName,
      description: 'Current graph state',
      createdAt: new Date().toISOString(),
      nodeCount: 0, // Would be dynamic
      mode: 'architecture'
    };

    setSavedViews([newView, ...savedViews]);
    setViewName('');
  };

  const handleLoadView = (view: any) => {
    // Implement view loading logic
    console.log('Loading view:', view);
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews(savedViews.filter(v => v.id !== viewId));
  };

  const handleExportViews = () => {
    const dataStr = JSON.stringify(savedViews, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'saved-views.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <VStack spacing={4} align="stretch" height="100%">
      {/* Save Current View */}
      <Box p={4} border="1px" borderColor="gray.200" borderRadius="md">
        <Text fontWeight="semibold" mb={3}>Save Current View</Text>
        <VStack spacing={3}>
          <Input
            placeholder="Enter view name..."
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
          <Button
            leftIcon={<Save size={16} />}
            onClick={handleSaveCurrentView}
            isDisabled={!viewName.trim()}
            colorScheme="blue"
            width="100%"
          >
            Save Current View
          </Button>
        </VStack>
      </Box>

      {/* Import/Export */}
      <HStack spacing={2}>
        <Button
          leftIcon={<Download size={16} />}
          onClick={handleExportViews}
          variant="outline"
          size="sm"
          flex={1}
        >
          Export
        </Button>
        <Button
          leftIcon={<Upload size={16} />}
          variant="outline"
          size="sm"
          flex={1}
        >
          Import
        </Button>
      </HStack>

      <Divider />

      {/* Saved Views List */}
      <Box>
        <Text fontWeight="semibold" mb={3}>Saved Views ({savedViews.length})</Text>
        
        {savedViews.length === 0 ? (
          <Alert status="info">
            <AlertIcon />
            No saved views yet. Save your current graph state to get started.
          </Alert>
        ) : (
          <VStack spacing={3} align="stretch">
            {savedViews.map((view) => (
              <Box
                key={view.id}
                p={3}
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                _hover={{ borderColor: 'blue.300', bg: 'blue.50' }}
                cursor="pointer"
                onClick={() => handleLoadView(view)}
              >
                <HStack justify="space-between" align="start">
                  <VStack align="start" spacing={1} flex={1}>
                    <Text fontWeight="semibold" fontSize="sm">
                      {view.name}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {view.description}
                    </Text>
                    <HStack spacing={2}>
                      <Badge size="sm" colorScheme="blue">
                        {view.mode}
                      </Badge>
                      <Badge size="sm" variant="outline">
                        {view.nodeCount} nodes
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {new Date(view.createdAt).toLocaleDateString()}
                    </Text>
                  </VStack>
                  
                  <IconButton
                    aria-label="Delete view"
                    icon={<Trash2 size={14} />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteView(view.id);
                    }}
                  />
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}


