/**
 * ActionItem - Reusable card for displaying actionable code quality findings
 * Shows severity-colored border, description, file path, effort/impact badges, and optional code diff
 */

import React, { useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Tag,
  Code,
  Collapse,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react';

interface ActionItemProps {
  title: string;
  description: string;
  filePath?: string;
  effort?: string;
  impact?: string;
  technique?: string;
  severity?: string;
  before?: string;
  after?: string;
}

const SEVERITY_BORDER_COLORS: Record<string, string> = {
  critical: 'red.500',
  high: 'orange.400',
  medium: 'yellow.400',
  low: 'green.400',
};

const SEVERITY_BADGE_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const IMPACT_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const EFFORT_COLORS: Record<string, string> = {
  XS: 'green',
  S: 'green',
  M: 'yellow',
  L: 'orange',
  XL: 'red',
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

const ActionItem: React.FC<ActionItemProps> = ({
  title,
  description,
  filePath,
  effort,
  impact,
  technique,
  severity = 'medium',
  before,
  after,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const codeBg = useColorModeValue('gray.50', 'gray.900');
  const hasDiff = before || after;
  const severityKey = severity?.toLowerCase() || 'medium';

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderLeft="4px solid"
      borderLeftColor={SEVERITY_BORDER_COLORS[severityKey] || 'gray.400'}
      borderRadius="md"
      p={3}
      transition="all 0.15s"
      _hover={{ shadow: 'sm' }}
    >
      {/* Header: severity badge + title */}
      <HStack justify="space-between" mb={1}>
        <HStack spacing={2} flex={1}>
          {severity && (
            <Badge
              colorScheme={SEVERITY_BADGE_COLORS[severityKey] || 'gray'}
              fontSize="2xs"
              textTransform="uppercase"
            >
              {severity}
            </Badge>
          )}
          <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
            {title}
          </Text>
        </HStack>
        {hasDiff && (
          <IconButton
            aria-label="Toggle code preview"
            icon={isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            size="xs"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          />
        )}
      </HStack>

      {/* Description */}
      <Text fontSize="xs" color={subtextColor} mb={2}>
        {description}
      </Text>

      {/* Footer: file path, effort, impact, technique */}
      <HStack spacing={2} flexWrap="wrap">
        {filePath && (
          <HStack spacing={1}>
            <FileCode size={12} color="var(--chakra-colors-gray-400)" />
            <Text fontSize="2xs" fontFamily="mono" color={subtextColor} noOfLines={1} maxW="200px">
              {filePath}
            </Text>
          </HStack>
        )}
        {effort && (
          <Badge
            colorScheme={EFFORT_COLORS[effort] || 'gray'}
            fontSize="2xs"
            variant="subtle"
          >
            Effort: {effort}
          </Badge>
        )}
        {impact && (
          <Badge
            colorScheme={IMPACT_COLORS[impact?.toLowerCase()] || 'gray'}
            fontSize="2xs"
            variant="subtle"
          >
            Impact: {impact}
          </Badge>
        )}
        {technique && (
          <Tag size="sm" colorScheme="blue" fontSize="2xs">
            {technique}
          </Tag>
        )}
      </HStack>

      {/* Collapsible code diff preview */}
      {hasDiff && (
        <Collapse in={isExpanded}>
          <VStack spacing={2} mt={3} align="stretch">
            {before && (
              <Box>
                <Text fontSize="2xs" fontWeight="semibold" color="red.400" mb={1}>
                  Before
                </Text>
                <Code
                  display="block"
                  p={2}
                  bg={codeBg}
                  fontSize="2xs"
                  borderRadius="md"
                  whiteSpace="pre-wrap"
                  maxH="120px"
                  overflowY="auto"
                >
                  {before}
                </Code>
              </Box>
            )}
            {after && (
              <Box>
                <Text fontSize="2xs" fontWeight="semibold" color="green.400" mb={1}>
                  After
                </Text>
                <Code
                  display="block"
                  p={2}
                  bg={codeBg}
                  fontSize="2xs"
                  borderRadius="md"
                  whiteSpace="pre-wrap"
                  maxH="120px"
                  overflowY="auto"
                >
                  {after}
                </Code>
              </Box>
            )}
          </VStack>
        </Collapse>
      )}
    </Box>
  );
};

export default ActionItem;
