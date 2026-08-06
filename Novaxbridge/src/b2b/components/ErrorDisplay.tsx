import { AlertTriangle, WifiOff, Lock, ServerCrash, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { B2BApiError } from '../lib/api';

interface ErrorDisplayProps {
  error: B2BApiError;
  onRetry?: () => void;
  className?: string;
}

function ErrorIcon({ type }: { type: string }) {
  switch (type) {
    case 'NETWORK_ERROR':
      return <WifiOff className="w-10 h-10 text-orange-400" />;
    case 'AUTH_ERROR':
      return <Lock className="w-10 h-10 text-red-400" />;
    case 'SERVER_ERROR':
      return <ServerCrash className="w-10 h-10 text-red-400" />;
    case 'NOT_FOUND':
      return <FileText className="w-10 h-10 text-gray-400" />;
    default:
      return <AlertTriangle className="w-10 h-10 text-amber-400" />;
  }
}

function ErrorTitle({ type }: { type: string }) {
  switch (type) {
    case 'NETWORK_ERROR':
      return 'Connection Failed';
    case 'AUTH_ERROR':
      return 'Access Denied';
    case 'SERVER_ERROR':
      return 'Server Error';
    case 'NOT_FOUND':
      return 'Not Found';
    default:
      return 'Something Went Wrong';
  }
}

export default function ErrorDisplay({ error, onRetry, className = '' }: ErrorDisplayProps) {
  return (
    <Card className={`border-red-200 bg-red-50/50 ${className}`}>
      <CardContent className="p-6 text-center">
        <div className="flex justify-center mb-3">
          <ErrorIcon type={error.type} />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          <ErrorTitle type={error.type} />
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
          {error.userMessage}
        </p>
        {error.status && (
          <p className="text-xs text-gray-400 mb-4 font-mono">
            Status: {error.status}
          </p>
        )}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
