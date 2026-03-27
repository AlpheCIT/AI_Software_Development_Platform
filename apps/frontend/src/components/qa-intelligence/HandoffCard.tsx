/**
 * HandoffCard - Shows data transferred between agents at pipeline transitions
 * Appears briefly on the arrow between agents, then fades out
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, Badge, useColorModeValue } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HandoffInfo } from '../../hooks/useAgentStream';

const MotionBox = motion(Box);

interface HandoffCardProps {
  handoff: HandoffInfo | undefined;
  fromColor: string;
  toColor: string;
  show: boolean;
}

export default function HandoffCard({ handoff, fromColor, toColor, show }: HandoffCardProps) {
  const [visible, setVisible] = useState(false);
  const bg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('cyan.200', 'cyan.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');

  useEffect(() => {
    if (show && handoff) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [show, handoff?.summary]);

  return (
    <AnimatePresence>
      {visible && handoff && (
        <MotionBox
          initial={{ opacity: 0, scale: 0.8, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 5 }}
          transition={{ duration: 0.3 }}
          position="absolute"
          zIndex={10}
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          pointerEvents="none"
        >
          <Box
            bg={bg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="md"
            px={2}
            py={1}
            maxW="180px"
            boxShadow="lg"
            textAlign="center"
          >
            <Text fontSize="2xs" color="cyan.500" fontWeight="bold" mb={0.5}>
              HANDOFF
            </Text>
            <Text fontSize="2xs" color={textColor} noOfLines={2}>
              {handoff.summary}
            </Text>
          </Box>
        </MotionBox>
      )}
    </AnimatePresence>
  );
}
