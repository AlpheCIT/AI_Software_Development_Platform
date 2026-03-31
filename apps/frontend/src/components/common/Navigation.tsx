import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  HStack,
  VStack,
  Button,
  Text,
  Badge,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  useColorModeValue,
  Flex,
  Spacer,
  Icon
} from '@chakra-ui/react';
import {
  Database,
  GitBranch,
  BarChart3,
  Zap,
  Settings,
  User,
  Bell,
  Search,
  Home,
  ChevronRight,
  Bot,
  Target,
  Activity,
  ExternalLink
} from 'lucide-react';

interface NavigationProps {
  children: React.ReactNode;
}

export default function Navigation({ children }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const navigationItems = [
    {
      path: '/repositories',
      label: 'Repositories',
      icon: Database,
      description: 'Manage repos, JIRA, AI insights'
    },
    {
      path: '/graph',
      label: 'Graph View',
      icon: GitBranch,
      description: 'Visualize code architecture'
    },
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Analytics & metrics'
    },
    {
      path: '/projects',
      label: 'Projects',
      icon: Target,
      description: 'Jira Kanban board & project management'
    },
    {
      path: '/simulation',
      label: 'Simulation',
      icon: Zap,
      description: 'What-if scenarios'
    }
  ];

  const getCurrentPage = () => {
    const current = navigationItems.find(item => location.pathname.startsWith(item.path));
    return current || navigationItems[0];
  };

  const currentPage = getCurrentPage();

  return (
    <Box minHeight="100vh" bg="gray.50">
      {/* Top Navigation Bar */}
      <Box bg={bg} borderBottom="1px" borderColor={borderColor} px={6} py={4}>
        <Flex align="center">
          {/* Logo & Brand */}
          <HStack spacing={3}>
            <Avatar name="AI Platform" size="sm" bg="blue.500" />
            <VStack align="start" spacing={0}>
              <Text fontWeight="bold" fontSize="lg">AI Dev Platform</Text>
              <Text fontSize="xs" color="gray.500">Code Intelligence & Analysis</Text>
            </VStack>
          </HStack>

          <Spacer />

          {/* Navigation Items */}
          <HStack spacing={1}>
            {navigationItems.map(item => (
              <Button
                key={item.path}
                variant={location.pathname.startsWith(item.path) ? 'solid' : 'ghost'}
                colorScheme={location.pathname.startsWith(item.path) ? 'blue' : 'gray'}
                size="sm"
                leftIcon={<Icon as={item.icon} size={16} />}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </HStack>

          <Spacer />

          {/* Right Side Actions */}
          <HStack spacing={2}>
            <IconButton
              aria-label="Search"
              icon={<Search size={18} />}
              variant="ghost"
              size="sm"
            />
            <IconButton
              aria-label="Notifications"
              icon={<Bell size={18} />}
              variant="ghost"
              size="sm"
            />
            
            {/* User Menu */}
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                size="sm"
                leftIcon={<User size={16} />}
              >
                User
              </MenuButton>
              <MenuList>
                <MenuItem icon={<Settings size={16} />}>Settings</MenuItem>
                <MenuItem icon={<User size={16} />}>Profile</MenuItem>
                <MenuDivider />
                <MenuItem icon={<ExternalLink size={16} />}>API Docs</MenuItem>
                <MenuItem>Sign out</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
      </Box>

      {/* Breadcrumbs */}
      <Box bg={bg} borderBottom="1px" borderColor={borderColor} px={6} py={2}>
        <Breadcrumb separator={<ChevronRight size={14} />}>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/')}>
              <Icon as={Home} size={14} />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>
              <HStack spacing={2}>
                <Icon as={currentPage.icon} size={14} />
                <Text>{currentPage.label}</Text>
              </HStack>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>

      {/* Feature Info Banner */}
      <Box bg="blue.50" borderBottom="1px" borderColor="blue.100" px={6} py={3}>
        <HStack justify="space-between" align="center">
          <HStack spacing={3}>
            <Icon as={currentPage.icon} size={20} color="blue.600" />
            <VStack align="start" spacing={0}>
              <Text fontWeight="medium" color="blue.900">
                {currentPage.label}
              </Text>
              <Text fontSize="sm" color="blue.700">
                {currentPage.description}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing={2}>
            {/* Feature-specific badges */}
            {location.pathname === '/repositories' && (
              <HStack spacing={1}>
                <Badge colorScheme="blue" size="sm">
                  <HStack spacing={1}>
                    <Icon as={Bot} size={12} />
                    <Text>AI Insights</Text>
                  </HStack>
                </Badge>
                <Badge colorScheme="green" size="sm">JIRA Integration</Badge>
                <Badge colorScheme="purple" size="sm">GitHub Sync</Badge>
              </HStack>
            )}
            {location.pathname === '/graph' && (
              <HStack spacing={1}>
                <Badge colorScheme="orange" size="sm">
                  <HStack spacing={1}>
                    <Icon as={Activity} size={12} />
                    <Text>Real-time</Text>
                  </HStack>
                </Badge>
                <Badge colorScheme="red" size="sm">Security Overlay</Badge>
                <Badge colorScheme="cyan" size="sm">Saved Views</Badge>
              </HStack>
            )}
            {location.pathname === '/projects' && (
              <HStack spacing={1}>
                <Badge colorScheme="green" size="sm">
                  <HStack spacing={1}>
                    <Icon as={Target} size={12} />
                    <Text>Kanban</Text>
                  </HStack>
                </Badge>
                <Badge colorScheme="blue" size="sm">Jira Sync</Badge>
                <Badge colorScheme="purple" size="sm">Real-time</Badge>
              </HStack>
            )}
            {location.pathname === '/simulation' && (
              <HStack spacing={1}>
                <Badge colorScheme="purple" size="sm">
                  <HStack spacing={1}>
                    <Icon as={Zap} size={12} />
                    <Text>What-if</Text>
                  </HStack>
                </Badge>
                <Badge colorScheme="teal" size="sm">Predictions</Badge>
              </HStack>
            )}

            {/* Quick Action Button */}
            {location.pathname === '/repositories' && (
              <Button size="xs" colorScheme="blue" variant="outline">
                Add Repository
              </Button>
            )}
            {location.pathname === '/graph' && (
              <Button size="xs" colorScheme="green" variant="outline">
                Save View
              </Button>
            )}
            {location.pathname.startsWith('/projects') && (
              <Button size="xs" colorScheme="blue" variant="outline">
                Create Issue
              </Button>
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box>
        {children}
      </Box>
    </Box>
  );
}


