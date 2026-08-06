import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Users, Briefcase, FileText, Target, DollarSign, UserCheck, Activity, Award, Download } from 'lucide-react';
import { getAnalyticsOverview, type AnalyticsOverview } from '../../lib/api';

const funnelSteps = [
  { key: 'pending', label: 'Pending', color: 'bg-yellow-400' },
  { key: 'reviewed', label: 'Reviewed', color: 'bg-blue-400' },
  { key: 'interviewed', label: 'Interviewed', color: 'bg-purple-400' },
  { key: 'offer', label: 'Offer', color: 'bg-orange-400' },
  { key: 'accepted', label: 'Accepted', color: 'bg-green-400' },
];

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 text-right">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8">{value}</span>
    </div>
  );
}

function MiniChart({ data, color, height = 60 }: { data: Record<string, number>; color: string; height?: number }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 1);
  const w = Math.max(entries.length * 40, 120);

  if (entries.length === 0) return <div className="text-xs text-gray-400 py-4 text-center">No data yet</div>;

  const pts = entries.map(([, v], i) => {
    const x = i * (w / (entries.length - 1 || 1));
    const y = height - (v / max) * (height - 10);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',');
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getAnalyticsOverview();
      setData(result);
    } catch {
      // handled silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }
  if (!data) {
    return <div className="text-center py-12 text-gray-400">Failed to load analytics</div>;
  }

  const maxFunnel = Math.max(...Object.values(data.pipeline.by_status), 1);
  const maxMonthly = Math.max(...Object.values(data.contracts.monthly_value), 1);
  const contractStatusEntries = Object.entries(data.contracts.by_status);

  const exportCSV = () => {
    const rows: string[] = ['Metric,Value'];
    rows.push(`Contract Value,${data.contracts.total_value}`);
    rows.push(`Total Contracts,${data.contracts.total}`);
    rows.push(`Active Jobs,${data.jobs.active}`);
    rows.push(`Team Members,${data.team.total}`);
    rows.push(`Saved Talent,${data.talent.saved}`);
    rows.push(`Talent Lists,${data.talent.lists}`);
    rows.push(`Saved Searches,${data.talent.saved_searches}`);
    rows.push(`Total Applications,${data.pipeline.total}`);
    for (const [status, count] of Object.entries(data.pipeline.by_status)) {
      rows.push(`Pipeline - ${status},${count}`);
    }
    for (const [status, count] of Object.entries(data.contracts.by_status)) {
      rows.push(`Contracts - ${status},${count}`);
    }
    for (const [mon, val] of Object.entries(data.contracts.monthly_value)) {
      rows.push(`Monthly Value - ${mon},${val}`);
    }
    for (const [role, count] of Object.entries(data.team.by_role)) {
      rows.push(`Team - ${role},${count}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500">Org-wide metrics and performance overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.contracts.total_value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Contract Value</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <FileText className="w-5 h-5 mx-auto text-purple-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.contracts.total}</p>
          <p className="text-xs text-gray-500">Contracts</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Briefcase className="w-5 h-5 mx-auto text-blue-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.jobs.active}</p>
          <p className="text-xs text-gray-500">Active Jobs</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Users className="w-5 h-5 mx-auto text-amber-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.team.total}</p>
          <p className="text-xs text-gray-500">Team Members</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Target className="w-5 h-5 mx-auto text-rose-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.talent.saved}</p>
          <p className="text-xs text-gray-500">Saved Talent</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="flex items-center gap-1"><Activity className="w-3 h-3" /> Pipeline</TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Contracts</TabsTrigger>
          <TabsTrigger value="talent" className="flex items-center gap-1"><Award className="w-3 h-3" /> Talent Pool</TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-1"><Users className="w-3 h-3" /> Team</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Application Funnel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {funnelSteps.map(s => (
                <Bar key={s.key} value={data.pipeline.by_status[s.key] || 0} max={maxFunnel} color={s.color} label={s.label} />
              ))}
              {data.pipeline.total === 0 && <p className="text-xs text-gray-400 text-center py-4">No applications yet</p>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Total Applications</p>
              <p className="text-xl font-bold text-gray-900">{data.pipeline.total}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Accepted</p>
              <p className="text-xl font-bold text-green-700">{data.pipeline.by_status.accepted || 0}</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {contractStatusEntries.map(([status, count]) => (
                  <Bar key={status} value={count} max={data.contracts.total} color="bg-purple-500" label={status} />
                ))}
                {data.contracts.total === 0 && <p className="text-xs text-gray-400 text-center py-4">No contracts yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Monthly Value (6 months)</CardTitle></CardHeader>
              <CardContent>
                <MiniChart data={data.contracts.monthly_value} color="#7c3aed" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="talent" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center">
              <UserCheck className="w-5 h-5 mx-auto text-purple-600 mb-1" />
              <p className="text-xl font-bold">{data.talent.saved}</p>
              <p className="text-xs text-gray-500">Saved</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Target className="w-5 h-5 mx-auto text-blue-600 mb-1" />
              <p className="text-xl font-bold">{data.talent.lists}</p>
              <p className="text-xs text-gray-500">Lists</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Activity className="w-5 h-5 mx-auto text-amber-600 mb-1" />
              <p className="text-xl font-bold">{data.talent.saved_searches}</p>
              <p className="text-xs text-gray-500">Searches</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Members by Role</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.team.by_role).map(([role, count]) => (
                <Bar key={role} value={count} max={data.team.total} color="bg-blue-500" label={role} />
              ))}
              {data.team.total === 0 && <p className="text-xs text-gray-400 text-center py-4">No team members</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
