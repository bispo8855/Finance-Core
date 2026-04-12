import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCcw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRASH DETECTADO PELO GLOBAL ERROR BOUNDARY:', error);
    console.error('Component Stack Trace:', errorInfo.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 flex flex-col items-center animate-in zoom-in duration-500">
            <div className="bg-destructive/10 p-4 rounded-2xl mb-6">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Ocorreu um erro inesperado na renderização desta página. 
              Geralmente um recarregamento resolve o problema.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div className="w-full bg-slate-900 rounded-lg p-4 mb-8 text-left overflow-auto max-h-40">
                <p className="text-pink-400 font-mono text-xs break-words">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button 
                onClick={this.handleReload} 
                className="flex-1 gap-2 h-12 text-md"
              >
                <RefreshCcw className="w-4 h-4" /> Recarregar App
              </Button>
              <Button 
                onClick={this.handleGoHome} 
                variant="outline" 
                className="flex-1 gap-2 h-12 text-md"
              >
                <Home className="w-4 h-4" /> Ir para Home
              </Button>
            </div>
          </div>
          
          <p className="mt-8 text-slate-400 text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
            <span className="w-8 h-[1px] bg-slate-200" />
            Aurys Intelligence System
            <span className="w-8 h-[1px] bg-slate-200" />
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
