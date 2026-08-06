import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const BUCKET = 'avatars';

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  onUpload: (url: string | null) => void;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function AvatarUpload({ userId, currentUrl, onUpload, name, size = 'xl' }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClass =
    size === 'sm' ? 'w-8 h-8' :
    size === 'md' ? 'w-12 h-12' :
    size === 'lg' ? 'w-16 h-16' :
    'w-20 h-20';

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';

  const getPublicUrl = useCallback((filePath: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, AVIF, and GIF images are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be under 10 MB (selected: ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    return null;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setProgress(10);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/avatar.${ext}`;

      // Delete any existing avatar first (cleanup old files)
      await supabase.storage.from(BUCKET).remove([filePath]);
      setProgress(30);

      // Upload with upsert
      const { error: uploadError, data } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });
      setProgress(80);

      if (uploadError) throw uploadError;

      const publicUrl = getPublicUrl(filePath);
      setProgress(100);

      onUpload(publicUrl);
      toast.success('Profile picture updated');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [userId, onUpload, getPublicUrl]);

  const handleRemove = useCallback(async () => {
    setUploading(true);
    try {
      // Try to remove all possible avatar files
      const prefixes = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
      await Promise.allSettled(
        prefixes.map((ext) =>
          supabase.storage.from(BUCKET).remove([`${userId}/avatar.${ext}`])
        )
      );
      setPreview(null);
      onUpload(null);
      toast.success('Profile picture removed');
    } catch (error) {
      toast.error('Failed to remove image');
    } finally {
      setUploading(false);
    }
  }, [userId, onUpload]);

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={`${sizeClass} border-2 border-border shadow-sm ring-2 ring-background`}>
          <AvatarImage src={displayUrl || undefined} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay on hover */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-0"
          title="Change profile picture"
        >
          {uploading ? (
            <Loader2 className={`${iconSize} animate-spin text-white`} />
          ) : (
            <Camera className={`${iconSize} text-white`} />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* Progress bar */}
      {uploading && progress > 0 && progress < 100 && (
        <div className="w-full max-w-[160px]">
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5 h-8 text-xs"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? 'Uploading...' : currentUrl ? 'Change' : 'Upload'}
        </Button>

        {(currentUrl || preview) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
            className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
