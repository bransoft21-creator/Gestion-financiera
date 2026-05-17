"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode; label?: string };
type State = { failed: boolean };

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-xs text-muted-foreground/60">
            {this.props.label ?? "No se pudo renderizar el gráfico"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
