import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { SessionInfo } from '../modules/session-tracker.js';
import { formatElapsed } from '../modules/time-format.js';

interface Props {
  session: SessionInfo;
}

export const SessionPanel: React.FC<Props> = ({ session }) => {
  const isActive = session.active;
  const elapsed = formatElapsed(Date.now() - session.lastActivity.getTime());

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? 'green' : 'gray'}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={isActive ? 'green' : 'cyan'}>
          {isActive ? (
            <>
              <Spinner type="dots" /> Claude Code
            </>
          ) : (
            'Claude Code'
          )}
        </Text>
        <Text color={isActive ? 'green' : 'gray'} bold={isActive}>
          [{isActive ? 'ACTIVE' : 'IDLE'}]
        </Text>
      </Box>

      {session.totalCount > 0 ? (
        <Box flexDirection="column" marginTop={0}>
          <Text color={isActive ? 'white' : 'gray'}>
            {session.currentTask !== '-' ? session.currentTask : 'No active task'}
          </Text>
          <Box gap={2}>
            <Text color="gray">
              {session.completedCount}/{session.totalCount} done
            </Text>
            <Text color="gray">{elapsed}</Text>
            {session.sessionId ? <Text color="gray">#{session.sessionId}</Text> : null}
          </Box>
        </Box>
      ) : (
        <Text color="gray">No session data</Text>
      )}
    </Box>
  );
};
