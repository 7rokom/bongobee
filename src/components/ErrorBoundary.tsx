import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    // Wipe the Mohasagor cache too — most common cause of stale-product crashes
    try { localStorage.removeItem('cache-mohasagor'); localStorage.removeItem('cache-mohasagor-v2'); } catch {}
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4 bg-card p-6 rounded-lg border">
            <h2 className="text-xl font-bold text-foreground">
              {this.props.fallbackTitle || 'কিছু একটা সমস্যা হয়েছে'}
            </h2>
            <p className="text-sm text-muted-foreground">
              পেজ লোড করতে সমস্যা হচ্ছে। নিচের বাটনে ক্লিক করে আবার চেষ্টা করুন।
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-destructive font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleReset} className="w-full">
              আবার চেষ্টা করুন
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
