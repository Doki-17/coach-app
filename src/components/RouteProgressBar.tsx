/**
 * A thin bar that quickly sweeps across the top of the page on every route
 * change. The app has no real async fetch to wait on, so this (plus the
 * fade-in on the page content itself) is purely a perceived-performance
 * touch - it gives navigation a bit of weight instead of feeling instant.
 * Remounts (and so replays its CSS animation) whenever `pathname` changes,
 * via the key prop passed in from App.tsx.
 */
export default function RouteProgressBar({ pathname }: { pathname: string }) {
  return (
    <div
      key={pathname}
      aria-hidden="true"
      className="route-progress-bar pointer-events-none fixed top-0 left-0 z-[100] h-[3px] bg-blue-600"
    />
  );
}
