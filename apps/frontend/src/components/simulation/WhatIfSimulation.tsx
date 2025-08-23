import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Progress,
  Alert,
  AlertIcon,
  Divider,
  Spinner
} from '@chakra-ui/react';
import { Play, Brain, TrendingUp, AlertTriangle } from 'lucide-react';

interface SimulationScenario {
  name: string;
  description: string;
  type: string;
  changes: string[];
}

interface PredictionResults {
  immediate: {
    performanceChange: number;
    resourceUsage: number;
    stability: number;
  };
  shortTerm: {
    maintainabilityImprovement: number;
    developmentVelocity: number;
    bugReduction: number;
  };
  longTerm: {
    scalabilityGain: number;
    technicalDebtReduction: number;
    teamProductivity: number;
  };
}

interface Recommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  content: string;
  reasoning: string;
}

interface SimulationResults {
  simulationId: string;
  type: string;
  predictions: PredictionResults;
  confidenceScores: {
    overall: number;
    factors: {
      dataQuality: number;
      modelAccuracy: number;
      historicalRelevance: number;
    };
  };
  recommendations: Recommendation[];
}

export default function WhatIfSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [scenario, setScenario] = useState<SimulationScenario>({
    name: '',
    description: '',
    type: 'architectural',
    changes: []
  });
  const [results, setResults] = useState<SimulationResults | null>(null);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    
    // Mock simulation - replace with real API call
    setTimeout(() => {
      setResults({
        simulationId: `sim_${Date.now()}`,
        type: scenario.type,
        predictions: {
          immediate: {
            performanceChange: -0.05,
            resourceUsage: 1.1,
            stability: 0.95
          },
          shortTerm: {
            maintainabilityImprovement: 0.15,
            developmentVelocity: 1.2,
            bugReduction: 0.1
          },
          longTerm: {
            scalabilityGain: 0.3,
            technicalDebtReduction: 0.25,
            teamProductivity: 1.15
          }
        },
        confidenceScores: {
          overall: 0.75,
          factors: {
            dataQuality: 0.8,
            modelAccuracy: 0.75,
            historicalRelevance: 0.7
          }
        },
        recommendations: [
          {
            type: 'implementation',
            priority: 'high',
            content: 'Implement changes gradually with comprehensive monitoring',
            reasoning: 'Reduces deployment risk and allows for real-time adjustment'
          },
          {
            type: 'monitoring',
            priority: 'medium',
            content: 'Set up performance monitoring for affected services',
            reasoning: 'Validate performance predictions against actual metrics'
          }
        ]
      });
      setIsRunning(false);
    }, 3000);
  };

  const formatPercentage = (value: number): string => {
    const percentage = Math.round(value * 100);
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage}%`;
  };

  const getChangeColor = (value: number): string => {
    if (value > 0) return 'green';
    if (value < 0) return 'red';
    return 'gray';
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            What-If Simulation
          </Text>
          <Text color="gray.600">
            Analyze the potential impact of architectural changes using AI-powered predictions
          </Text>
        </Box>

        {/* Scenario Configuration */}
        <Card>
          <CardHeader>
            <Text fontSize="lg" fontWeight="semibold">Configure Scenario</Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <HStack spacing={4}>
                <Box flex={1}>
                  <Text mb={2} fontWeight="medium">Scenario Name</Text>
                  <Input
                    placeholder="e.g., Add Payment Service"
                    value={scenario.name}
                    onChange={(e) => setScenario({...scenario, name: e.target.value})}
                  />
                </Box>
                <Box flex={1}>
                  <Text mb={2} fontWeight="medium">Simulation Type</Text>
                  <Select
                    value={scenario.type}
                    onChange={(e) => setScenario({...scenario, type: e.target.value})}
                  >
                    <option value="architectural">Architectural Change</option>
                    <option value="performance">Performance Optimization</option>
                    <option value="security">Security Enhancement</option>
                    <option value="refactoring">Code Refactoring</option>
                  </Select>
                </Box>
              </HStack>

              <Box>
                <Text mb={2} fontWeight="medium">Description</Text>
                <Textarea
                  placeholder="Describe the changes you want to simulate..."
                  value={scenario.description}
                  onChange={(e) => setScenario({...scenario, description: e.target.value})}
                  rows={4}
                />
              </Box>

              <Button
                leftIcon={isRunning ? <Spinner size="sm" /> : <Play size={20} />}
                onClick={handleRunSimulation}
                isLoading={isRunning}
                loadingText="Running Simulation..."
                colorScheme="blue"
                isDisabled={!scenario.name || !scenario.description}
              >
                Run Simulation
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="semibold">Simulation Results</Text>
                <Badge colorScheme="green">Completed</Badge>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={6} align="stretch">
                {/* Overall Confidence */}
                <Box p={4} bg="blue.50" borderRadius="md">
                  <HStack spacing={4} align="center">
                    <Brain size={24} color="blue" />
                    <Box flex={1}>
                      <Text fontWeight="semibold">Overall Confidence</Text>
                      <Progress 
                        value={results.confidenceScores.overall * 100} 
                        colorScheme="blue"
                        size="lg"
                      />
                    </Box>
                    <Text fontSize="lg" fontWeight="bold">
                      {Math.round(results.confidenceScores.overall * 100)}%
                    </Text>
                  </HStack>
                </Box>

                {/* Predictions */}
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Impact Predictions</Text>
                  
                  {/* Immediate Impact */}
                  <Box mb={4}>
                    <Text fontWeight="medium" mb={2}>Immediate Impact</Text>
                    <HStack spacing={4}>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Performance</Text>
                        <Text 
                          fontSize="lg" 
                          fontWeight="bold" 
                          color={`${getChangeColor(results.predictions.immediate.performanceChange)}.500`}
                        >
                          {formatPercentage(results.predictions.immediate.performanceChange)}
                        </Text>
                      </Box>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Resource Usage</Text>
                        <Text 
                          fontSize="lg" 
                          fontWeight="bold" 
                          color={`${getChangeColor(results.predictions.immediate.resourceUsage - 1)}.500`}
                        >
                          {formatPercentage(results.predictions.immediate.resourceUsage - 1)}
                        </Text>
                      </Box>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Stability</Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.500">
                          {Math.round(results.predictions.immediate.stability * 100)}%
                        </Text>
                      </Box>
                    </HStack>
                  </Box>

                  {/* Long-term Impact */}
                  <Box>
                    <Text fontWeight="medium" mb={2}>Long-term Benefits</Text>
                    <HStack spacing={4}>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Scalability</Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.500">
                          {formatPercentage(results.predictions.longTerm.scalabilityGain)}
                        </Text>
                      </Box>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Technical Debt</Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.500">
                          {formatPercentage(results.predictions.longTerm.technicalDebtReduction)}
                        </Text>
                      </Box>
                      <Box flex={1} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="sm" color="gray.600">Team Productivity</Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.500">
                          {formatPercentage(results.predictions.longTerm.teamProductivity - 1)}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                </Box>

                <Divider />

                {/* Recommendations */}
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={4}>AI Recommendations</Text>
                  <VStack spacing={3} align="stretch">
                    {results.recommendations.map((rec, index) => (
                      <Alert key={index} status={rec.priority === 'high' ? 'warning' : 'info'}>
                        <AlertIcon />
                        <Box>
                          <Text fontWeight="semibold">{rec.content}</Text>
                          <Text fontSize="sm" color="gray.600">{rec.reasoning}</Text>
                        </Box>
                      </Alert>
                    ))}
                  </VStack>
                </Box>

                {/* Confidence Factors */}
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Confidence Factors</Text>
                  <VStack spacing={2} align="stretch">
                    {Object.entries(results.confidenceScores.factors).map(([factor, score]) => (
                      <HStack key={factor} justify="space-between">
                        <Text textTransform="capitalize">{factor.replace(/([A-Z])/g, ' $1')}</Text>
                        <HStack spacing={2}>
                          <Progress value={score * 100} width="100px" size="sm" />
                          <Text fontSize="sm" minWidth="40px">
                            {Math.round(score * 100)}%
                          </Text>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
}