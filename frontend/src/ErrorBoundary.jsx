import React from "react";

// Last line of defense: whatever throws inside the tree, the user sees a
// calm recovery screen instead of a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("AstroAgent UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <span className="error-star">✦</span>
            <h2>The sky clouded over for a moment</h2>
            <p>Something unexpected happened in the app. Your conversation is saved.</p>
            <button onClick={() => window.location.reload()}>Return to the stars</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
