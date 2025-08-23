/**
 * Create Issue Modal Component
 * Modal for creating new Jira issues
 */

import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  Select,
  Switch,
  Badge,
  Text,
  useToast
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (issueData: any) => Promise<void>;
  projectKey: string;
}

interface IssueFormData {
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  storyPoints?: number;
  labels: string;
  assignToMe: boolean;
}

export default function CreateIssueModal({ isOpen, onClose, onSubmit, projectKey }: CreateIssueModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<IssueFormData>({
    defaultValues: {
      summary: '',
      description: '',
      issueType: 'Story',
      priority: 'Medium',
      storyPoints: undefined,
      labels: '',
      assignToMe: false
    }
  });

  const handleFormSubmit = async (data: IssueFormData) => {
    setIsSubmitting(true);
    
    try {
      const issueData = {
        summary: data.summary,
        description: data.description,
        issueType: { name: data.issueType },
        priority: { name: data.priority },
        storyPoints: data.storyPoints,
        labels: data.labels ? data.labels.split(',').map(l => l.trim()).filter(l => l) : [],
        projectKey
      };

      await onSubmit(issueData);
      reset();
      onClose();
      
      toast({
        title: 'Issue Created',
        description: `New ${data.issueType.toLowerCase()} created successfully`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create issue',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  const issueTypes = [
    { value: 'Story', label: 'Story', description: 'Feature request from user perspective' },
    { value: 'Task', label: 'Task', description: 'Work that needs to be done' },
    { value: 'Bug', label: 'Bug', description: 'Problem that needs to be fixed' },
    { value: 'Epic', label: 'Epic', description: 'Large body of work' }
  ];

  const priorities = [
    { value: 'Highest', label: 'Highest', color: 'red' },
    { value: 'High', label: 'High', color: 'red' },
    { value: 'Medium', label: 'Medium', color: 'orange' },
    { value: 'Low', label: 'Low', color: 'green' },
    { value: 'Lowest', label: 'Lowest', color: 'green' }
  ];

  const selectedIssueType = watch('issueType');
  const selectedPriority = watch('priority');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <ModalHeader>Create New Issue</ModalHeader>
          <ModalCloseButton isDisabled={isSubmitting} />
          
          <ModalBody>
            <VStack spacing={5} align="stretch">
              {/* Project Info */}
              <HStack justify="space-between" p={3} bg="gray.50" borderRadius="md">
                <Text fontSize="sm" color="gray.600">Project:</Text>
                <Badge colorScheme="blue">{projectKey}</Badge>
              </HStack>

              {/* Issue Type */}
              <FormControl isInvalid={!!errors.issueType}>
                <FormLabel>Issue Type</FormLabel>
                <Select {...register('issueType', { required: 'Issue type is required' })}>
                  {issueTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  {issueTypes.find(t => t.value === selectedIssueType)?.description}
                </Text>
                <FormErrorMessage>{errors.issueType?.message}</FormErrorMessage>
              </FormControl>

              {/* Summary */}
              <FormControl isInvalid={!!errors.summary}>
                <FormLabel>Summary</FormLabel>
                <Input
                  {...register('summary', { 
                    required: 'Summary is required',
                    minLength: { value: 3, message: 'Summary must be at least 3 characters' }
                  })}
                  placeholder="Brief description of the issue"
                />
                <FormErrorMessage>{errors.summary?.message}</FormErrorMessage>
              </FormControl>

              {/* Description */}
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  {...register('description')}
                  placeholder="Detailed description of the issue (optional)"
                  rows={4}
                />
              </FormControl>

              {/* Priority and Story Points */}
              <HStack spacing={4}>
                <FormControl isInvalid={!!errors.priority} flex={1}>
                  <FormLabel>Priority</FormLabel>
                  <Select {...register('priority', { required: 'Priority is required' })}>
                    {priorities.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </Select>
                  <FormErrorMessage>{errors.priority?.message}</FormErrorMessage>
                </FormControl>

                <FormControl flex={1}>
                  <FormLabel>Story Points</FormLabel>
                  <Input
                    {...register('storyPoints', { 
                      valueAsNumber: true,
                      min: { value: 0, message: 'Story points must be positive' },
                      max: { value: 100, message: 'Story points must be less than 100' }
                    })}
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <FormErrorMessage>{errors.storyPoints?.message}</FormErrorMessage>
                </FormControl>
              </HStack>

              {/* Labels */}
              <FormControl>
                <FormLabel>Labels</FormLabel>
                <Input
                  {...register('labels')}
                  placeholder="frontend, backend, urgent (comma-separated)"
                />
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Separate multiple labels with commas
                </Text>
              </FormControl>

              {/* Assign to Me */}
              <FormControl>
                <HStack justify="space-between">
                  <FormLabel mb={0}>Assign to me</FormLabel>
                  <Switch {...register('assignToMe')} />
                </HStack>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Automatically assign this issue to yourself
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button 
              variant="ghost" 
              mr={3} 
              onClick={handleClose}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              colorScheme="blue" 
              isLoading={isSubmitting}
              loadingText="Creating..."
            >
              Create Issue
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
