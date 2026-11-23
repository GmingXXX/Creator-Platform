import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Appearance = 'light' | 'dark';
const storageKey = 'zc-appearance';
const listeners = new Set<() => void>();

function readAppearance(): Appearance {
  try {
    return window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function currentAppearance(): Appearance {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.theme = appearance;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--zc-bg').trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  listeners.forEach(listener => listener());
}

export function initializeAppearance() {
  applyAppearance(readAppearance());
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyAppearance(readAppearance());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function AppearanceToggle({ className = '' }: { className?: string }) {
  const appearance = useSyncExternalStore(subscribe, currentAppearance);
  const dark = appearance === 'dark';
  const label = dark ? '切换到浅色模式' : '切换到暗色模式';
  const CurrentIcon = dark ? Moon : Sun;

  function toggleAppearance() {
    const next = dark ? 'light' : 'dark';
    applyAppearance(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Theme still applies for this session when browser storage is unavailable.
    }
  }

  return (
    <button type="button" className={`appearance-toggle ${className}`} title={label} aria-label={label} onClick={toggleAppearance}>
      <CurrentIcon size={16} aria-hidden="true" />
      <span className="appearance-label">{dark ? '暗色模式' : '浅色模式'}</span>
      <span className="appearance-track" aria-hidden="true"><span /></span>
    </button>
  );
}
