import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Loader2, MapPin, Briefcase, Star, Save, X } from 'lucide-react';
import RatingBadge from '@/components/marketplace/RatingBadge';
import {
  searchTalent, saveSearch, getSavedSearches, deleteSavedSearch,
  type TalentProfile, type TalentSearchParams, type SavedSearch,
} from '../../lib/api';

const AVG_RATINGS = [4, 4.5, 3, 3.5];

export default function TalentSearch() {
  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [results, setResults] = useState<TalentProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentFilters: TalentSearchParams = { q: query || undefined, skills: skills || undefined, location: location || undefined, availability: availability || undefined };

  const doSearch = useCallback(async (params: TalentSearchParams) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await searchTalent(params);
      setResults(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const result = await getSavedSearches();
      setSavedSearches(result.data);
    } catch { /* ignore */ }
  }, []);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      await saveSearch(saveName.trim(), currentFilters as unknown as Record<string, unknown>);
      setShowSaveDialog(false);
      setSaveName('');
      loadSaved();
    } catch { /* ignore */ }
  };

  const applySavedSearch = (s: SavedSearch) => {
    const f = s.filters as TalentSearchParams;
    setQuery(f.q || '');
    setSkills(f.skills || '');
    setLocation(f.location || '');
    setAvailability(f.availability || '');
    doSearch(f);
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteSavedSearch(id);
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search talent by name, skill, or keyword..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(currentFilters)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => doSearch(currentFilters)} disabled={isSearching}>
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Skills (comma-separated)"
              value={skills}
              onChange={e => setSkills(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-40"
            />
            <Select value={availability} onValueChange={setAvailability}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_to_work">Open to Work</SelectItem>
                <SelectItem value="open_to_collab">Open to Collab</SelectItem>
                <SelectItem value="not_available">Not Available</SelectItem>
              </SelectContent>
            </Select>

            {availability && (
              <Button variant="ghost" size="sm" onClick={() => setAvailability('')}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Save search button */}
          {results.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <p className="text-sm text-gray-500">{totalCount} result{totalCount !== 1 ? 's' : ''}</p>
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(!showSaveDialog)}>
                <Save className="w-3 h-3 mr-1" />
                Save Search
              </Button>
            </div>
          )}

          {showSaveDialog && (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Name this search..."
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved searches sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Searches</h3>
              {savedSearches.length === 0 ? (
                <p className="text-xs text-gray-400">No saved searches yet</p>
              ) : (
                <div className="space-y-1">
                  {savedSearches.map(s => (
                    <div key={s.id} className="flex items-center justify-between group">
                      <button
                        onClick={() => applySavedSearch(s)}
                        className="text-xs text-purple-600 hover:text-purple-800 truncate"
                      >
                        {s.name}
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(s.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-3">
          {searchError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{searchError}</div>
          )}

          {!isSearching && results.length === 0 && !searchError && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search the talent pool to find candidates</p>
            </div>
          )}

          {isSearching ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            results.map(talent => (
              <Card key={talent.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold flex-shrink-0">
                    {talent.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{talent.full_name || 'Unnamed'}</p>
                        {talent.headline && (
                          <p className="text-xs text-gray-500 mt-0.5">{talent.headline}</p>
                        )}
                        <RatingBadge average={0} count={0} size="sm" />
                      </div>
                      <Badge variant="outline" className={
                        talent.availability === 'open_to_work' ? 'border-green-200 text-green-700 bg-green-50' :
                        talent.availability === 'open_to_collab' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                        'border-gray-200 text-gray-400'
                      }>
                        {talent.availability === 'open_to_work' ? 'Open to Work' :
                         talent.availability === 'open_to_collab' ? 'Open to Collab' :
                         talent.availability || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                      {talent.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {talent.location}
                        </span>
                      )}
                      {talent.skills && talent.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {talent.skills.slice(0, 5).map(skill => (
                            <span key={skill} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                              {skill}
                            </span>
                          ))}
                          {talent.skills.length > 5 && (
                            <span className="text-gray-400">+{talent.skills.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
