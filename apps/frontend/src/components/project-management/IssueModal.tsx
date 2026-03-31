/**
 * Issue Modal Component
 * Modal for creating and editing Jira issues
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  VStack,
  HStack,
  Badge,
  Box,
  Text,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  IconButton
} from '@chakra-ui/react';
import { AddIcon, CloseIcon } from '@chakra-ui/icons';
import { useJiraMetadata } from '../../hooks/useJiraMetadata';

interface Issue {
  id?: string;
  key?: string;
  summary: string;
  description?: string;
  issueType: string;
  priority: string;
  assignee?: {
    accountId: string;
    displayName: string;
  };
  labels: string[];
  storyPoints?: number;
}

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (issue: Issue) => Promise<void>;
  issue?: Issue;
  mode: 'create' | 'edit';
  projectKey: string;
}

export function IssueModal({
  isOpen,
  onClose,
  onSave,
  issue,
  mode,
  projectKey
}: IssueModalProps) {
  const [formData, setFormData] = useState<Issue>({
    summary: '',
    description: '',
    issueType: 'Task',
    priority: 'Medium',
    labels: [],
    storyPoints: undefined
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const {
    issueTypes,
    priorities,
    users,
    isLoading: metadataLoading,
    error: metadataError
  } = useJiraMetadata(projectKey);

  useEffect(() => {
    if (issue && mode === 'edit') {
      setFormData({
        ...issue,
        labels: issue.labels || []
      });
    } else {
      setFormData({
        summary: '',
        description: '',
        issueType: issueTypes[0]?.name || 'Task',
        priority: 'Medium',
        labels: [],
        storyPoints: undefined
      });
    }
    setErrors({});
  }, [issue, mode, isOpen, issueTypes]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.summary.trim()) {
      newErrors.summary = 'Summary is required';
    }

    if (!formData.issueType) {
      newErrors.issueType = 'Issue type is required';
    }

    if (!formData.priority) {
      newErrors.priority = 'Priority is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
      toast({
        title: mode === 'create' ? 'Issue Created' : 'Issue Updated',
        description: `Issue ${mode === 'create' ? 'created' : 'updated'} successfully`,
        status: 'success',
        duration: 3000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: `${mode === 'create' ? 'Creation' : 'Update'} Failed`,
        description: errorMessage,
        status: 'error',
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLabel = () => {
    if (newLabel.trim() && !formData.labels.includes(newLabel.trim())) {
      setFormData(prev => ({
        ...prev,
        labels: [...prev.labels, newLabel.trim()]
      }));
      setNewLabel('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove)
    }));
  };

  const handleInputChange = (field: keyof Issue, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  if (metadataLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalBody p={8} textAlign="center">
            <Spinner size="lg" color="blue.500" />
            <Text mt={4}>Loading issue metadata...</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  if (metadataError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Error</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="error">
              <AlertIcon />
              Failed to load issue metadata: {metadataError.message}
            </Alert>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {mode === 'create' ? 'Create Issue' : `Edit Issue ${issue?.key}`}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Summary */}
            <FormControl isRequired isInvalid={!!errors.summary}>
              <FormLabel>Summary</FormLabel>
              <Input
                value={formData.summary}
                onChange={(e) => handleInputChange('summary', e.target.value)}
                placeholder="Enter a brief summary of the issue"
              />
              {errors.summary && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {errors.summary}
                </Text>
              )}
            </FormControl>

            {/* Description */}
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Provide a detailed description of the issue"
                rows={4}
              />
            </FormControl>

            {/* Issue Type and Priority */}
            <HStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.issueType}>
                <FormLabel>Issue Type</FormLabel>
                <Select
                  value={formData.issueType}
                  onChange={(e) => handleInputChange('issueType', e.target.value)}
                >
                  {issueTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </Select>
                {errors.issueType && (
                  <Text color="red.500" fontSize="sm" mt={1}>
                    {errors.issueType}
                  </Text>
                )}
              </FormControl>

              <FormControl isRequired isInvalid={!!errors.priority}>
                <FormLabel>Priority</FormLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                >
                  {priorities.map((priority) => (
                    <option key={priority.id} value={priority.name}>
                      {priority.name}
                    </option>
                  ))}
                </Select>
                {errors.priority && (
                  <Text color="red.500" fontSize="sm" mt={1}>
                    {errors.priority}
                  </Text>
                )}
              </FormControl>
            </HStack>

            {/* Assignee and Story Points */}
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Assignee</FormLabel>
                <Select
                  value={formData.assignee?.accountId || ''}
                  onChange={(e) => {
                    const selectedUser = users.find(user => user.accountId === e.target.value);
                    handleInputChange('assignee', selectedUser ? {
                      accountId: selectedUser.accountId,
                      displayName: selectedUser.displayName
                    } : undefined);
                  }}
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.accountId} value={user.accountId}>
                      {user.displayName}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {formData.issueType === 'Story' && (
                <FormControl>
                  <FormLabel>Story Points</FormLabel>
                  <NumberInput
                    value={formData.storyPoints || ''}
                    onChange={(valueString) => {
                      const value = parseInt(valueString) || undefined;
                      handleInputChange('storyPoints', value);
                    }}
                    min={0}
                    max={100}
                  >
                    <NumberInputField placeholder="0" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}
            </HStack>

            {/* Labels */}
            <FormControl>
              <FormLabel>Labels</FormLabel>
              <VStack align="stretch" spacing={2}>
                <HStack>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add a label"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                  />
                  <IconButton
                    aria-label="Add label"
                    icon={<AddIcon />}
                    onClick={handleAddLabel}
                    isDisabled={!newLabel.trim()}
                    size="sm"
                  />
                </HStack>
                
                {formData.labels.length > 0 && (
                  <Box>
                    <HStack spacing={2} flexWrap="wrap">
                      {formData.labels.map((label) => (
                        <Badge
                          key={label}
                          variant="subtle"
                          colorScheme="blue"
                          cursor="pointer"
                          onClick={() => handleRemoveLabel(label)}
                        >
                          {label}
                          <CloseIcon ml={1} boxSize={2} />
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}
              </VStack>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSave}
            isLoading={isSaving}
            loadingText={mode === 'create' ? 'Creating...' : 'Updating...'}
          >
            {mode === 'create' ? 'Create Issue' : 'Update Issue'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default IssueModal;


