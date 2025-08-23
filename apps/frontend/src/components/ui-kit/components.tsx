import { Badge } from '@chakra-ui/react';

export function SeverityPill({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const scheme = level === 'LOW' ? 'green' : level === 'MEDIUM' ? 'orange' : level === 'HIGH' ? 'red' : 'red';
  return (
    <Badge variant="severity" colorScheme={scheme}>
      {level}
    </Badge>
  );
}

export function CoverageRing({ value = 0.8, size = 24 }: { value: number; size?: number }) {
  const pct = Math.round(value * 100);
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `conic-gradient(#3182ce ${pct}%, #edf2f7 0)`
  } as const;
  
  return <div style={style} aria-label={`Coverage ${pct}%`} />;
}