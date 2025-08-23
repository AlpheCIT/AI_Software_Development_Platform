import React, { useState } from 'react';
import { 
  HStack, 
  Input, 
  Button, 
  Select, 
  IconButton,
  InputGroup,
  InputLeftElement 
} from '@chakra-ui/react';
import { Search } from 'lucide-react';
import type { GraphMode, OverlayType } from '../../types/graph';

interface GraphToolbarProps {
  onSearch: (query: string) => void;
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  activeOverlay: OverlayType | null;
  onOverlayChange: (overlay: OverlayType | null) => void;
}

export default function GraphToolbar({
  onSearch,
  mode,
  onModeChange,
  activeOverlay,
  onOverlayChange
}: GraphToolbarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <HStack spacing={4} mt={4}>
      {/* Search */}
      <InputGroup maxW="400px">
        <InputLeftElement>
          <Search size={20} />
        </InputLeftElement>
        <Input
          placeholder="Search nodes, files, functions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </InputGroup>
      
      <Button onClick={handleSearch} size="sm">
        Search
      </Button>
      
      {searchQuery && (
        <Button 
          onClick={() => {
            setSearchQuery('');
            onSearch('');
          }} 
          variant="outline" 
          size="sm"
        >
          Clear
        </Button>
      )}
    </HStack>
  );
}
