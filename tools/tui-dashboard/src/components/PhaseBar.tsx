import React, { useRef, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { PhaseInfo } from '../modules/phase-tracker.js';

interface PhaseBarProps {
  phases: PhaseInfo[];
  isWaveBased?: boolean;
}

export const PhaseBar: React.FC<PhaseBarProps> = ({ phases, isWaveBased }) => {
  const activePhase = phases.find((p) => p.status === 'active');
  const activeNum = activePhase?.number ?? -1;
  const prevActiveNum = useRef<number>(activeNum);
  const [highlightNum, setHighlightNum] = useState<number>(-1);

  useEffect(() => {
    if (activeNum !== prevActiveNum.current && activeNum !== -1) {
      setHighlightNum(activeNum);
      const t = setTimeout(() => setHighlightNum(-1), 2000);
      prevActiveNum.current = activeNum;
      return () => clearTimeout(t);
    }
    prevActiveNum.current = activeNum;
    return undefined;
  }, [activeNum]);

  if (phases.length === 0) return null;

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} gap={0}>
      <Text bold color="magenta">
        페이즈{' '}
      </Text>
      {phases.map((phase, i) => (
        <Box key={phase.number} gap={0}>
          {i > 0 && (
            <Text color="gray" dimColor>
              {' → '}
            </Text>
          )}
          <PhaseSegment
            phase={phase}
            highlight={highlightNum === phase.number}
            isWaveBased={isWaveBased}
          />
        </Box>
      ))}
    </Box>
  );
};

const PhaseSegment: React.FC<{ phase: PhaseInfo; highlight: boolean; isWaveBased?: boolean }> = ({
  phase,
  highlight,
  isWaveBased,
}) => {
  const label = isWaveBased ? `W${phase.number}` : `P${phase.number}`;

  if (phase.status === 'done') {
    return (
      <Text color="green">
        {label}
        <Text color="green">✓</Text>
      </Text>
    );
  }

  if (phase.status === 'active') {
    return (
      <Box backgroundColor={highlight ? 'yellow' : undefined}>
        <Text color={highlight ? 'black' : 'cyan'}>
          {label}
          <Text color={highlight ? 'black' : 'cyan'}>
            <Spinner type="dots" />
          </Text>
          <Text color={highlight ? 'black' : 'white'}>{phase.name}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Text color="gray" dimColor>
      {label}-
    </Text>
  );
};
