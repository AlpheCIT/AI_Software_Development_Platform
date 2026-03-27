/**
 * DirectoryTree - Recursive collapsible file tree for the Repo Wiki
 *
 * Groups files by directory, shows language badges, risk dots, and
 * documentation warning icons. Clicking a file selects it for the
 * detail pane.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Icon,
  Collapse,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import {
  FileCode,
  Folder,
  FolderOpen,
  AlertTriangle,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { WikiFile, WikiEntity } from '../../hooks/useRepoWiki';

// ── Types ──────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: WikiFile;
  entityCount: number;
}

interface DirectoryTreeProps {
  files: WikiFile[];
  entities: WikiEntity[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

// ── Language color map ─────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  typescript: 'blue',
  javascript: 'yellow',
  python: 'green',
  java: 'orange',
  csharp: 'purple',
  go: 'cyan',
  rust: 'red',
  ruby: 'red',
  php: 'purple',
  vue: 'green',
  svelte: 'orange',
  json: 'gray',
  yaml: 'gray',
  markdown: 'gray',
};

// ── Build Tree ─────────────────────────────────────────────────────────────

function buildTree(files: WikiFile[], entities: WikiEntity[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [], entityCount: 0 };

  // Entity count by directory prefix
  const entityByDir: Record<string, number> = {};
  for (const e of entities) {
    const parts = e.file.split('/');
    for (let i = 1; i <= parts.length - 1; i++) {
      const dir = parts.slice(0, i).join('/');
      entityByDir[dir] = (entityByDir[dir] || 0) + 1;
    }
  }

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: partPath,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
          entityCount: isLast ? file.entityCount : (entityByDir[partPath] || 0),
        };
        current.children.push(child);
      }
      if (!isLast) {
        current = child;
      }
    }
  }

  // Sort: directories first, then alphabetical
  function sortTree(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const c of node.children) {
      if (c.isDir) sortTree(c);
    }
  }
  sortTree(root);

  return root;
}

// ── Risk Dot ───────────────────────────────────────────────────────────────

function RiskDot({ score }: { score: number }) {
  const color = score >= 60 ? 'red.400' : score >= 30 ? 'yellow.400' : 'green.400';
  return (
    <Box
      w="8px"
      h="8px"
      borderRadius="full"
      bg={color}
      flexShrink={0}
      title={`Risk: ${score}`}
    />
  );
}

// ── Directory Node ─────────────────────────────────────────────────────────

function DirNode({
  node,
  selectedFile,
  onSelectFile,
  depth,
}: {
  node: TreeNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const countColor = useColorModeValue('gray.500', 'gray.500');

  return (
    <Box>
      <HStack
        px={2}
        py={1}
        pl={`${depth * 16 + 8}px`}
        spacing={2}
        cursor="pointer"
        borderRadius="md"
        _hover={{ bg: hoverBg }}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
      >
        <Icon as={isOpen ? ChevronDown : ChevronRight} boxSize={3} color={textColor} />
        <Icon as={isOpen ? FolderOpen : Folder} boxSize={4} color="orange.400" />
        <Text fontSize="sm" fontWeight="medium" color={textColor} isTruncated>
          {node.name}
        </Text>
        {node.entityCount > 0 && (
          <Text fontSize="xs" color={countColor}>
            {node.entityCount}
          </Text>
        )}
      </HStack>
      <Collapse in={isOpen} animateOpacity>
        {node.children.map((child) =>
          child.isDir ? (
            <DirNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ) : (
            <FileNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ),
        )}
      </Collapse>
    </Box>
  );
}

// ── File Node ──────────────────────────────────────────────────────────────

function FileNode({
  node,
  selectedFile,
  onSelectFile,
  depth,
}: {
  node: TreeNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const isSelected = selectedFile === node.path;
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'gray.300');

  const file = node.file;
  const langColor = file ? LANG_COLORS[file.language] || 'gray' : 'gray';
  const needsDocWarning = file && file.entityCount >= 3 && !file.hasDocumentation;

  return (
    <HStack
      px={2}
      py={1}
      pl={`${depth * 16 + 8}px`}
      spacing={2}
      cursor="pointer"
      borderRadius="md"
      bg={isSelected ? selectedBg : 'transparent'}
      _hover={{ bg: isSelected ? selectedBg : hoverBg }}
      onClick={() => onSelectFile(node.path)}
      role="button"
      aria-selected={isSelected}
    >
      <Box w="12px" /> {/* spacer for alignment with dir chevrons */}
      <Icon as={FileCode} boxSize={4} color={`${langColor}.400`} />
      <Text fontSize="sm" color={textColor} isTruncated flex={1}>
        {node.name}
      </Text>
      {file && (
        <>
          <Badge
            size="sm"
            colorScheme={langColor}
            variant="subtle"
            fontSize="9px"
            textTransform="lowercase"
          >
            {file.language}
          </Badge>
          {file.riskScore > 0 && <RiskDot score={file.riskScore} />}
          {needsDocWarning && (
            <Icon as={AlertTriangle} boxSize={3} color="yellow.500" />
          )}
        </>
      )}
    </HStack>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  files,
  entities,
  selectedFile,
  onSelectFile,
}) => {
  const [search, setSearch] = useState('');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const inputBg = useColorModeValue('white', 'gray.800');

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const lower = search.toLowerCase();
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(lower) ||
        f.language.toLowerCase().includes(lower),
    );
  }, [files, search]);

  const tree = useMemo(
    () => buildTree(filteredFiles, entities),
    [filteredFiles, entities],
  );

  return (
    <VStack spacing={0} align="stretch" h="100%">
      {/* Search */}
      <Box p={2} borderBottom="1px solid" borderColor={borderColor}>
        <InputGroup size="sm">
          <InputLeftElement>
            <Icon as={Search} boxSize={3} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg={inputBg}
            borderRadius="md"
            fontSize="sm"
          />
        </InputGroup>
      </Box>

      {/* Tree */}
      <Box flex={1} overflowY="auto" py={1}>
        {tree.children.length === 0 ? (
          <Text fontSize="sm" color="gray.500" textAlign="center" py={8}>
            No files found
          </Text>
        ) : (
          tree.children.map((node) =>
            node.isDir ? (
              <DirNode
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={0}
              />
            ) : (
              <FileNode
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={0}
              />
            ),
          )
        )}
      </Box>
    </VStack>
  );
};

export default DirectoryTree;
