import { Component, ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return this.props.fallback ?? <div className="empty glass"><h5>3D view unavailable</h5><p className="dim">WebGL could not start ({this.state.err.message}). Try another browser, or lower the graphics quality in Settings.</p></div>;
    return this.props.children;
  }
}
export const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
