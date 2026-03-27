/**
 * RoleSwitcher - Compact segmented control for switching between user roles
 * Uses Chakra UI ButtonGroup to provide Developer / PM / Executive views
 */

import React from 'react';
import { ButtonGroup, Button, Icon, Tooltip } from '@chakra-ui/react';
import { Code, Briefcase, BarChart3 } from 'lucide-react';
import { useRole, type UserRole } from '../../context/RoleContext';

interface RoleOption {
  value: UserRole;
  label: string;
  icon: React.ElementType;
  colorScheme: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'developer', label: 'Developer', icon: Code, colorScheme: 'blue' },
  { value: 'pm', label: 'Product Manager', icon: Briefcase, colorScheme: 'teal' },
  { value: 'executive', label: 'Executive', icon: BarChart3, colorScheme: 'purple' },
];

const RoleSwitcher: React.FC = () => {
  const { role, setRole } = useRole();

  return (
    <ButtonGroup size="sm" isAttached variant="outline">
      {ROLE_OPTIONS.map((option) => {
        const isActive = role === option.value;
        return (
          <Tooltip key={option.value} label={option.label} placement="top" hasArrow>
            <Button
              onClick={() => setRole(option.value)}
              colorScheme={isActive ? option.colorScheme : 'gray'}
              variant={isActive ? 'solid' : 'outline'}
              leftIcon={<Icon as={option.icon} boxSize={4} />}
              fontWeight={isActive ? 'semibold' : 'normal'}
              _hover={{ opacity: 0.85 }}
            >
              {option.label}
            </Button>
          </Tooltip>
        );
      })}
    </ButtonGroup>
  );
};

export default RoleSwitcher;
