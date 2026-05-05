/**
 * js/components.jsx  (loaded by Babel standalone)
 * Reusable React UI sub-components shared across the control panel.
 *
 * Exports to window:
 *   SectionHeader   — collapsible section toggle button with accent line
 */

// ── SectionHeader ──────────────────────────────────────────────────────────
// Renders a clickable header row that controls one collapsible panel section.
// Props:
//   title    {string}   uppercase section label
//   open     {boolean}  whether the section is expanded
//   onToggle {()=>void} called on click (without drag)
//   accent   {string}   CSS colour for open-state highlights  (default #00ff88)
//   count    {string}   optional sub-label text (multiline supported)
window.SectionHeader = function SectionHeader({ title, open, onToggle, accent = '#00ff88', count }) {
  // Use pointer-down + up to distinguish tap from scroll-drag
  const startRef = React.useRef(null);

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
  };

  const handlePointerUp = (e) => {
    if (!startRef.current) return;
    const dx = Math.abs((e.clientX ?? 0) - startRef.current.x);
    const dy = Math.abs((e.clientY ?? 0) - startRef.current.y);
    startRef.current = null;
    if (dx < 8 && dy < 8) {
      e.currentTarget.blur && e.currentTarget.blur();
      onToggle();
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', marginBottom: open ? '10px' : '0',
        borderRadius: '7px', cursor: 'pointer',
        background: open ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${open ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.2s ease', userSelect: 'none',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textAlign: 'center' }}>
        <span style={{
          fontSize: '11px', fontWeight: 'bold', letterSpacing: '1.2px',
          textTransform: 'uppercase', color: open ? '#e0e0e0' : '#666', transition: 'color 0.2s ease',
        }}>{title}</span>
        {count != null && (
          <span style={{
            fontSize: '10px', color: open ? accent : '#444', fontWeight: 'normal',
            letterSpacing: '0.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap', transition: 'color 0.2s ease',
          }}>{count}</span>
        )}
      </div>
      <span style={{
        fontSize: '14px', color: open ? accent : '#555',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.25s ease, color 0.2s ease', lineHeight: 1,
      }}>▾</span>
    </div>
  );
};
