import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Loader2, Send, GraduationCap, ArrowLeft, Brain, Lightbulb,
  RefreshCw, Sparkles, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { callTutorAI, TutorMessage, TutorQuestion, TutorQuizResult } from '@/lib/ai';
import { TutorSession, KnowledgeBaseEntry } from '@/lib/ai';

export default function TutorChat() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<TutorSession | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);

  // Knowledge base
  const [kbEntries, setKbEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [isAddingKb, setIsAddingKb] = useState(false);
  const [kbDialogOpen, setKbDialogOpen] = useState(false);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<TutorQuestion[] | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<TutorQuizResult | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const { data, error } = await supabase
          .from('tutor_sessions')
          .select('*')
          .eq('id', id!)
          .single();
        if (error) throw error;
        setSession(data as unknown as TutorSession);

        const { data: msgs, error: msgErr } = await supabase
          .from('tutor_messages')
          .select('*')
          .eq('session_id', id!)
          .order('created_at', { ascending: true });
        if (msgErr) throw msgErr;
        setMessages((msgs || []).map((m) => ({ role: m.role as TutorMessage['role'], content: m.content })));
      } catch {
        toast.error('Error loading session');
        navigate('/tutor');
      } finally {
        setIsLoading(false);
      }
    };

    const loadKnowledgeBase = async () => {
      const { data } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      setKbEntries(data as unknown as KnowledgeBaseEntry[] || []);
    };

    if (user && id) {
      loadSessionData();
      loadKnowledgeBase();
    }
  }, [user, id, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = async (role: TutorMessage['role'], content: string) => {
    await supabase.from('tutor_messages').insert({
      session_id: id!,
      role,
      content,
    }).maybeSingle();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');

    const userMsg: TutorMessage = { role: 'student', content: text };
    setMessages((prev) => [...prev, userMsg]);
    await saveMessage('student', text);
    setIsSending(true);

    try {
      const selectedKb = kbEntries.find((kb) => kb.id === selectedKbId);

      const result = await callTutorAI({
        mode: 'tutor_chat',
        topic: session?.topic || undefined,
        knowledgeContent: selectedKb?.content,
        messages: [...messages, userMsg],
        studentStrengths: session?.strengths || undefined,
        studentWeaknesses: session?.weaknesses || undefined,
      });

      const tutorMsg: TutorMessage = { role: 'tutor', content: result as string };
      setMessages((prev) => [...prev, tutorMsg]);
      await saveMessage('tutor', result as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleReflect = async () => {
    if (messages.length === 0) return;
    setIsReflecting(true);
    setReflection(null);
    try {
      const result = await callTutorAI({
        mode: 'tutor_reflect',
        topic: session?.topic || undefined,
        messages,
        studentStrengths: session?.strengths || undefined,
        studentWeaknesses: session?.weaknesses || undefined,
      });
      setReflection(result as string);
    } catch {
      toast.error('Failed to generate reflection');
    } finally {
      setIsReflecting(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizResult(null);
    setQuizAnswers([]);
    try {
      const selectedKb = kbEntries.find((kb) => kb.id === selectedKbId);
      const result = await callTutorAI({
        mode: 'tutor_quiz',
        topic: session?.topic || 'general',
        knowledgeContent: selectedKb?.content,
      });
      const questions = JSON.parse(result as string) as TutorQuestion[];
      setQuizQuestions(questions);
      setQuizAnswers(new Array(questions.length).fill(-1));
    } catch {
      toast.error('Failed to generate quiz. Try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGradeQuiz = async () => {
    if (!quizQuestions) return;
    const unanswered = quizAnswers.findIndex((a) => a === -1);
    if (unanswered !== -1) {
      toast.error(`Answer question ${unanswered + 1} first`);
      return;
    }
    setIsGrading(true);
    try {
      const result = await callTutorAI({
        mode: 'tutor_grade',
        questions: quizQuestions,
        answers: quizAnswers,
      });
      setQuizResult(result as TutorQuizResult);
    } catch {
      toast.error('Failed to grade quiz');
    } finally {
      setIsGrading(false);
    }
  };

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbTitle.trim() || !newKbContent.trim()) return;
    setIsAddingKb(true);
    try {
      const { data, error } = await supabase.from('knowledge_base').insert({
        owner_id: user!.id,
        title: newKbTitle.trim(),
        content: newKbContent.trim(),
        source_type: 'manual',
      }).select().single();
      if (error) throw error;
      setKbEntries((prev) => [data as unknown as KnowledgeBaseEntry, ...prev]);
      setSelectedKbId(data!.id);
      setNewKbTitle('');
      setNewKbContent('');
      setKbDialogOpen(false);
      toast.success('Knowledge base entry added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add entry');
    } finally {
      setIsAddingKb(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session && isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen pt-20 pb-4 px-4">
      <div className="container mx-auto max-w-6xl h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tutor')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-secondary" />
                {session.title}
              </h1>
              {session.topic && (
                <p className="text-sm text-muted-foreground">{session.topic}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Knowledge Base Selector */}
            <Dialog open={kbDialogOpen} onOpenChange={setKbDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Brain className="w-4 h-4 mr-1.5" />
                  Knowledge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Knowledge Base</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {kbEntries.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select knowledge source</Label>
                      <div className="grid gap-2">
                        <Button
                          variant={selectedKbId === null ? 'secondary' : 'outline'}
                          size="sm"
                          className="justify-start"
                          onClick={() => setSelectedKbId(null)}
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Tutor general knowledge
                        </Button>
                        {kbEntries.map((kb) => (
                          <Button
                            key={kb.id}
                            variant={selectedKbId === kb.id ? 'secondary' : 'outline'}
                            size="sm"
                            className="justify-start"
                            onClick={() => setSelectedKbId(kb.id)}
                          >
                            <Brain className="w-4 h-4 mr-2" />
                            {kb.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <form onSubmit={handleAddKnowledge} className="space-y-3 pt-4 border-t">
                    <Label>Add learning material</Label>
                    <Input
                      placeholder="Title (e.g. Python Functions Notes)"
                      value={newKbTitle}
                      onChange={(e) => setNewKbTitle(e.target.value)}
                      required
                    />
                    <Textarea
                      placeholder="Paste your notes, code snippets, or learning material here..."
                      className="min-h-[200px]"
                      value={newKbContent}
                      onChange={(e) => setNewKbContent(e.target.value)}
                      required
                    />
                    <Button type="submit" disabled={isAddingKb}>
                      {isAddingKb ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add to Knowledge Base
                    </Button>
                  </form>
                </div>
              </DialogContent>
            </Dialog>

            {/* Reflection */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleReflect} disabled={isReflecting || messages.length === 0}>
                  {isReflecting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Lightbulb className="w-4 h-4 mr-1.5" />}
                  Reflect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Learning Reflection</DialogTitle>
                </DialogHeader>
                {isReflecting ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                  </div>
                ) : reflection ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{reflection}</div>
                ) : (
                  <p className="text-muted-foreground">No reflection generated yet.</p>
                )}
              </DialogContent>
            </Dialog>

            {/* Quiz */}
            <Dialog onOpenChange={(open) => { if (!open) { setQuizResult(null); setQuizQuestions(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => { if (!quizQuestions) handleGenerateQuiz(); }}>
                  <ClipboardList className="w-4 h-4 mr-1.5" />
                  Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {quizResult ? 'Quiz Results' : quizQuestions ? 'Answer the Quiz' : 'Generating Quiz...'}
                  </DialogTitle>
                </DialogHeader>

                {isGeneratingQuiz && (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                    <p className="text-muted-foreground">Generating quiz...</p>
                  </div>
                )}

                {quizQuestions && !quizResult && (
                  <div className="space-y-6">
                    {quizQuestions.map((q, qi) => (
                      <div key={qi} className="space-y-2">
                        <p className="font-medium text-sm">
                          {qi + 1}. {q.question}
                        </p>
                        <div className="grid gap-1.5">
                          {q.options.map((opt, oi) => (
                            <Button
                              key={oi}
                              variant={quizAnswers[qi] === oi ? 'secondary' : 'outline'}
                              size="sm"
                              className="justify-start text-left h-auto py-2 px-3"
                              onClick={() => {
                                setQuizAnswers((prev) => {
                                  const next = [...prev];
                                  next[qi] = oi;
                                  return next;
                                });
                              }}
                            >
                              {opt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button onClick={handleGradeQuiz} disabled={isGrading} className="w-full">
                      {isGrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Submit Answers
                    </Button>
                  </div>
                )}

                {quizResult && (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold text-secondary mb-2">{quizResult.score}%</div>
                      <p className="text-muted-foreground">
                        {quizResult.correctCount} of {quizResult.total} correct
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {quizResult.feedback}
                    </div>
                    <Button variant="outline" onClick={handleGenerateQuiz} className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Another Quiz
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-12 h-12 text-secondary mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Start Learning</h3>
              <p className="text-muted-foreground max-w-md">
                Ask a question about {session.topic || 'your topic'}.
                The AI tutor will guide you step by step.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'student'
                      ? 'bg-secondary text-secondary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  {msg.role === 'tutor' && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Tutor
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  Tutor is thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 bg-card border border-border rounded-xl p-2 flex items-end gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Ask a question, paste code, or describe what you are stuck on..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] max-h-[120px] border-0 resize-none focus-visible:ring-0"
            rows={1}
            disabled={isSending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
