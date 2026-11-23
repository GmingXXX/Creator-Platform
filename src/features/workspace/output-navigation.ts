import type { NavigateFunction } from 'react-router-dom';
import { useStudio } from '../../domain/store';

/** Open an existing result in its own space without moving or copying the work. */
export function navigateInWorkspace(navigate: NavigateFunction, workspaceId: string | undefined, destination: string | number) {
  const studio = useStudio.getState();
  const origin = workspaceId || 'personal';
  if (studio.activeWorkspaceId !== origin) studio.setWorkspace(origin);
  if (typeof destination === 'number') navigate(destination);
  else navigate(destination);
}
