// src/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // opcional: envía a tu logging
    console.error("[ErrorBoundary] error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 24, fontFamily: "ui-sans-serif, system-ui"}}>
          <h1 style={{fontSize: 22, marginBottom: 8}}>Se produjo un error en la aplicación</h1>
          <pre style={{whiteSpace: "pre-wrap", background:"#fff3f3", padding: 12, border:"1px solid #f5c2c7", borderRadius: 8}}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <p style={{marginTop: 12, color:"#666"}}>Revisa la consola (F12 → Console) para más detalles.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
