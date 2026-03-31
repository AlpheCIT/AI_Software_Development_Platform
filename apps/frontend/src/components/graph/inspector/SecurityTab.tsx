import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Progress,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Alert,
  AlertIcon,
  AlertDescription,
  useColorModeValue,
  Icon,
  Tooltip
} from '@chakra-ui/react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Lock,
  Eye,
  AlertCircle,
  Info
} from 'lucide-react';
import { InspectorSecurityData } from '../../../lib/api/inspector';

interface SecurityTabProps {
  security: InspectorSecurityData;
  isLoading?: boolean;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ security, isLoading = false }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const statBgColor = useColorModeValue('gray.50', 'gray.700');

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return AlertTriangle;
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return Info;
      default: return Info;
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getSecurityStatusIcon = (hasIssue: boolean, isGood?: boolean) => {
    if (isGood === true) return CheckCircle;
    if (hasIssue) return AlertTriangle;
    return CheckCircle;
  };

  const getSecurityStatusColor = (hasIssue: boolean, isGood?: boolean) => {
    if (isGood === true) return 'green';
    if (hasIssue) return 'red';
    return 'green';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVulnerabilityCount = (severity: string) => {
    return security.vulnerabilities.filter(v => v.severity.toLowerCase() === severity.toLowerCase()).length;
  };

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading security data...</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Security Score Header */}
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <HStack justify="space-between" w="full">
              <VStack align="start" spacing={1}>
                <HStack>
                  <Shield size={20} />
                  <Text fontSize="lg" fontWeight="bold">Security Analysis</Text>
                </HStack>
                <Text fontSize="sm" color={textColor}>
                  Overall security assessment and vulnerability analysis
                </Text>
              </VStack>
              
              <VStack align="end" spacing={1}>
                <Badge 
                  colorScheme={getRiskLevelColor(security.riskLevel)} 
                  variant="solid"
                  fontSize="md"
                  px={3}
                  py={1}
                >
                  {security.riskLevel.toUpperCase()} RISK
                </Badge>
                <Text fontSize="xs" color={textColor}>
                  Risk Score: {security.riskScore}/100
                </Text>
              </VStack>
            </HStack>

            <Progress 
              value={100 - security.riskScore} 
              colorScheme={getRiskLevelColor(security.riskLevel)}
              size="lg"
              borderRadius="md"
              bg={statBgColor}
            />
          </VStack>
        </CardBody>
      </Card>

      {/* Vulnerability Statistics */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel color="red.500">Critical</StatLabel>
              <StatNumber color="red.500">{getVulnerabilityCount('critical')}</StatNumber>
              <StatHelpText fontSize="xs">Immediate action required</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel color="orange.500">High</StatLabel>
              <StatNumber color="orange.500">{getVulnerabilityCount('high')}</StatNumber>
              <StatHelpText fontSize="xs">Priority resolution</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel color="yellow.500">Medium</StatLabel>
              <StatNumber color="yellow.500">{getVulnerabilityCount('medium')}</StatNumber>
              <StatHelpText fontSize="xs">Plan for resolution</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card size="sm" bg={statBgColor}>
          <CardBody>
            <Stat size="sm">
              <StatLabel color="green.500">Low</StatLabel>
              <StatNumber color="green.500">{getVulnerabilityCount('low')}</StatNumber>
              <StatHelpText fontSize="xs">Monitor and review</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Security Controls */}
      <Card>
        <CardHeader>
          <HStack>
            <Lock size={16} />
            <Text fontSize="md" fontWeight="medium">Security Controls</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <VStack align="start" spacing={3}>
              <HStack>
                <Icon 
                  as={getSecurityStatusIcon(false, security.dataFlowSecurity.inputValidation)} 
                  color={`${getSecurityStatusColor(false, security.dataFlowSecurity.inputValidation)}.500`}
                  boxSize={4}
                />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">Input Validation</Text>
                  <Text fontSize="xs" color={textColor}>
                    {security.dataFlowSecurity.inputValidation ? 'Implemented' : 'Missing'}
                  </Text>
                </VStack>
              </HStack>

              <HStack>
                <Icon 
                  as={getSecurityStatusIcon(false, security.dataFlowSecurity.outputEncoding)} 
                  color={`${getSecurityStatusColor(false, security.dataFlowSecurity.outputEncoding)}.500`}
                  boxSize={4}
                />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">Output Encoding</Text>
                  <Text fontSize="xs" color={textColor}>
                    {security.dataFlowSecurity.outputEncoding ? 'Implemented' : 'Missing'}
                  </Text>
                </VStack>
              </HStack>

              <HStack>
                <Icon 
                  as={getSecurityStatusIcon(false, security.dataFlowSecurity.csrfProtection)} 
                  color={`${getSecurityStatusColor(false, security.dataFlowSecurity.csrfProtection)}.500`}
                  boxSize={4}
                />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">CSRF Protection</Text>
                  <Text fontSize="xs" color={textColor}>
                    {security.dataFlowSecurity.csrfProtection ? 'Enabled' : 'Disabled'}
                  </Text>
                </VStack>
              </HStack>
            </VStack>

            <VStack align="start" spacing={3}>
              <HStack>
                <Badge 
                  colorScheme={getSeverityColor(security.dataFlowSecurity.sqlInjectionRisk)}
                  variant="subtle"
                >
                  {security.dataFlowSecurity.sqlInjectionRisk.toUpperCase()}
                </Badge>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">SQL Injection Risk</Text>
                  <Text fontSize="xs" color={textColor}>Database interaction security</Text>
                </VStack>
              </HStack>

              <HStack>
                <Badge 
                  colorScheme={getSeverityColor(security.dataFlowSecurity.xssRisk)}
                  variant="subtle"
                >
                  {security.dataFlowSecurity.xssRisk.toUpperCase()}
                </Badge>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">XSS Risk</Text>
                  <Text fontSize="xs" color={textColor}>Cross-site scripting vulnerability</Text>
                </VStack>
              </HStack>
            </VStack>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Vulnerabilities List */}
      {security.vulnerabilities.length > 0 && (
        <Card>
          <CardHeader>
            <HStack justify="space-between">
              <HStack>
                <AlertTriangle size={16} />
                <Text fontSize="md" fontWeight="medium">Vulnerabilities</Text>
              </HStack>
              <Badge variant="outline">
                {security.vulnerabilities.length} found
              </Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            <Accordion allowToggle>
              {security.vulnerabilities.slice(0, 10).map((vuln, index) => {
                const SeverityIcon = getSeverityIcon(vuln.severity);
                return (
                  <AccordionItem key={index}>
                    <AccordionButton>
                      <HStack flex="1" textAlign="left">
                        <Icon as={SeverityIcon} boxSize={4} color={`${getSeverityColor(vuln.severity)}.500`} />
                        <VStack align="start" spacing={0} flex="1">
                          <Text fontSize="sm" fontWeight="medium">
                            {vuln.title || `${vuln.category} Issue`}
                          </Text>
                          <HStack spacing={2}>
                            <Badge 
                              colorScheme={getSeverityColor(vuln.severity)} 
                              size="xs"
                              variant="solid"
                            >
                              {vuln.severity.toUpperCase()}
                            </Badge>
                            {vuln.cwe && (
                              <Badge size="xs" variant="outline">
                                CWE-{vuln.cwe}
                              </Badge>
                            )}
                            {vuln.line && (
                              <Text fontSize="xs" color={textColor}>
                                Line {vuln.line}
                              </Text>
                            )}
                          </HStack>
                        </VStack>
                      </HStack>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel>
                      <VStack align="start" spacing={3}>
                        <Text fontSize="sm">{vuln.description}</Text>
                        
                        {vuln.recommendation && (
                          <Alert status="info" size="sm">
                            <AlertIcon boxSize={3} />
                            <AlertDescription fontSize="xs">
                              <Text fontWeight="medium">Recommendation:</Text>
                              <Text>{vuln.recommendation}</Text>
                            </AlertDescription>
                          </Alert>
                        )}

                        <HStack justify="space-between" w="full" fontSize="xs" color={textColor}>
                          <Text>Category: {vuln.category}</Text>
                          <Text>Detected: {formatDate(vuln.lastDetected)}</Text>
                        </HStack>
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {security.vulnerabilities.length > 10 && (
              <Text fontSize="xs" color={textColor} textAlign="center" mt={3}>
                Showing 10 of {security.vulnerabilities.length} vulnerabilities
              </Text>
            )}
          </CardBody>
        </Card>
      )}

      {/* Security Hotspots */}
      {security.securityHotspots.length > 0 && (
        <Card>
          <CardHeader>
            <HStack>
              <Eye size={16} />
              <Text fontSize="md" fontWeight="medium">Security Hotspots</Text>
              <Badge variant="outline">{security.securityHotspots.length}</Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              {security.securityHotspots.slice(0, 5).map((hotspot, index) => (
                <Card key={index} size="sm" variant="outline">
                  <CardBody>
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <HStack>
                          <Badge 
                            colorScheme={getRiskLevelColor(hotspot.riskLevel)}
                            size="sm"
                            variant="solid"
                          >
                            {hotspot.riskLevel.toUpperCase()}
                          </Badge>
                          <Text fontSize="sm" fontWeight="medium">{hotspot.type}</Text>
                        </HStack>
                        <Text fontSize="xs" color={textColor}>{hotspot.description}</Text>
                        <Text fontSize="xs" color={textColor}>Line {hotspot.line}</Text>
                      </VStack>
                      <Tooltip label={hotspot.recommendation}>
                        <Icon as={Info} boxSize={4} color="blue.500" cursor="help" />
                      </Tooltip>
                    </HStack>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* No Issues Found */}
      {security.vulnerabilities.length === 0 && security.securityHotspots.length === 0 && (
        <Card>
          <CardBody>
            <VStack spacing={3}>
              <Icon as={CheckCircle} boxSize={12} color="green.500" />
              <VStack spacing={1}>
                <Text fontSize="lg" fontWeight="medium" color="green.500">
                  No Security Issues Found
                </Text>
                <Text fontSize="sm" color={textColor} textAlign="center">
                  This component appears to follow security best practices.
                  Continue monitoring for new vulnerabilities.
                </Text>
              </VStack>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
};

export default SecurityTab;


