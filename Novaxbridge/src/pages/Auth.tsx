import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Rocket, Mail, Lock, User, Building2, Loader2, ChevronDown, ChevronUp, Copy, CheckCheck } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'firm'>('student');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) throw error;
      toast.success('Check your email for the confirmation link!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error signing up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Successfully signed in!');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error signing in');
    } finally {
      setIsLoading(false);
    }
  };

  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const testAccounts = [
    { role: 'Admin', email: 'admin@skillbridge.africa', password: 'Admin@123456' },
    { role: 'Student', email: 'sarah.j@example.com', password: 'User@123456' },
    { role: 'Organization', email: 'hr@techvista.io', password: 'Org@123456' },
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <Rocket className="w-8 h-8 text-secondary" />
            <span className="text-2xl font-bold tracking-tight text-primary">
              SkillBridge <span className="text-secondary">Africa</span>
            </span>
          </div>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Sign in to access the marketplace.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Test Accounts for Beta Testers */}
            <Card>
              <button
                type="button"
                onClick={() => setShowTestAccounts(!showTestAccounts)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-secondary" />
                  Test Accounts (Beta)
                </span>
                {showTestAccounts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showTestAccounts && (
                <CardContent className="pt-0 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Use these pre-configured accounts to test the platform. Click to copy credentials.
                  </p>
                  {testAccounts.map((account) => (
                    <div key={account.role} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{account.role}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => copyToClipboard(`${account.email}\n${account.password}`, account.role)}
                        >
                          {copied === account.role ? (
                            <><CheckCheck className="w-3 h-3 mr-1 text-green-500" />Copied</>
                          ) : (
                            <><Copy className="w-3 h-3 mr-1" />Copy</>
                          )}
                        </Button>
                      </div>
                      <div
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() => copyToClipboard(account.email, account.role)}
                      >
                        <Mail className="w-3 h-3" />
                        <span>{account.email}</span>
                      </div>
                      <div
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() => copyToClipboard(account.password, account.role)}
                      >
                        <Lock className="w-3 h-3" />
                        <span>{account.password}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create an Account</CardTitle>
                <CardDescription>Join the SkillBridge Africa community.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>I am a...</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        type="button"
                        variant={role === 'student' ? 'secondary' : 'outline'}
                        className="w-full"
                        onClick={() => setRole('student')}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Student
                      </Button>
                      <Button
                        type="button"
                        variant={role === 'firm' ? 'secondary' : 'outline'}
                        className="w-full"
                        onClick={() => setRole('firm')}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Firm
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
