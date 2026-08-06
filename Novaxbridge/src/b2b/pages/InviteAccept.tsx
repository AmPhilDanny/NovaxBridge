import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { acceptInvite } from '../lib/api';

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing invitation token.');
      return;
    }
    acceptInvite(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/b2b/dashboard'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Failed to accept invitation.');
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
            <p className="mt-4 text-gray-600">Accepting invitation...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Invitation Accepted!</h2>
            <p className="mt-2 text-sm text-gray-500">Redirecting to your dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Invalid or Expired Invite</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <Link to="/b2b/dashboard" className="mt-4 inline-block text-sm text-purple-600 hover:underline">
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
