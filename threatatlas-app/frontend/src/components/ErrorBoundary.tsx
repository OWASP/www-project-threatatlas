import { Component, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md w-full rounded-xl border-destructive/30 shadow-lg">
            <CardContent className="flex flex-col items-center text-center p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
                An unexpected error occurred. Please try again.
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground/70 font-mono mb-4 max-w-full truncate">
                  {this.state.error.message}
                </p>
              )}
              <Button onClick={this.handleReset} variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
