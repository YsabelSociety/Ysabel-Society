import { Component, Suspense, type ReactNode } from 'react';

// A delayed optional section must never blank the navigation or the current feed.
export default class SectionLoader extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="section-loading" role="alert"><p>This section could not load.</p><button onClick={() => window.location.reload()}>Reload workspace</button></div>;
    return <Suspense fallback={<div className="section-loading" role="status"><span className="section-loading-mark" />Opening workspace…</div>}>{this.props.children}</Suspense>;
  }
}
