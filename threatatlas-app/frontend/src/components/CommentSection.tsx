import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Pencil, Trash2, Check, X, MessageSquarePlus } from 'lucide-react';

interface Comment {
  id?: string;
  userId?: number;
  text: string;
  author: string;
  timestamp: string;
}

interface CommentSectionProps {
  comments: string | null;
  onSave: (newComments: string) => void;
  canWrite: boolean;
  authorName?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function CommentSection({ comments, onSave, canWrite, authorName }: CommentSectionProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const currentUserId = user?.id;
  const defaultAuthorName = authorName || user?.full_name || user?.email || 'Unknown User';

  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Parse existing comments
  let parsedComments: Comment[] = [];
  if (comments) {
    try {
      const parsed = JSON.parse(comments);
      if (Array.isArray(parsed)) {
        parsedComments = parsed.map((c: any) => ({
          ...c,
          id: c.id || generateId()
        }));
      } else {
        // Fallback for non-array JSON
        parsedComments = [{ id: generateId(), text: comments, author: 'System', timestamp: new Date().toISOString() }];
      }
    } catch {
      // Legacy note (plain text)
      parsedComments = [{ id: generateId(), text: comments, author: 'Legacy', timestamp: new Date().toISOString() }];
    }
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const commentObj: Comment = {
      id: generateId(),
      userId: currentUserId,
      text: newComment.trim(),
      author: defaultAuthorName,
      timestamp: new Date().toISOString(),
    };

    const updatedComments = [...parsedComments, commentObj];
    onSave(JSON.stringify(updatedComments));
    setNewComment('');
    setShowInput(false);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editCommentText.trim()) return;
    
    const updatedComments = parsedComments.map(c => {
      if (c.id === commentId) {
        return { ...c, text: editCommentText.trim() };
      }
      return c;
    });

    onSave(JSON.stringify(updatedComments));
    setEditingId(null);
    setEditCommentText('');
  };

  const handleDelete = (commentId: string) => {
    const updatedComments = parsedComments.filter(c => c.id !== commentId);
    onSave(JSON.stringify(updatedComments));
  };

  const canModify = (comment: Comment) => {
    if (!canWrite) return false;
    if (isAdmin) return true;
    if (comment.userId && currentUserId === comment.userId) return true;
    if (comment.author && comment.author === defaultAuthorName) return true;
    return false;
  };

  return (
    <div className="space-y-3">
      {parsedComments.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {parsedComments.map((comment) => (
            <div key={comment.id} className="bg-muted/50 p-3 rounded-lg border border-border/40 space-y-1 group">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground/80 text-[11px]">{comment.author}</span>
                  <span className="text-[10px] text-muted-foreground opacity-70">
                    {format(new Date(comment.timestamp), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                
                {canModify(comment) && editingId !== comment.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      aria-label="Edit comment"
                      onClick={() => {
                        setEditingId(comment.id || null);
                        setEditCommentText(comment.text);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                      aria-label="Delete comment"
                      onClick={() => handleDelete(comment.id as string)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              {editingId === comment.id ? (
                <div className="space-y-2 mt-2">
                  <Textarea
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleSaveEdit(comment.id as string)}>
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed mt-1.5">
                  {comment.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {canWrite && !editingId && (
        showInput ? (
          <div className="space-y-2 mt-2 pt-2 border-t border-border/40">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="text-xs min-h-[60px] resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => { setShowInput(false); setNewComment(''); }}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Add comment
          </button>
        )
      )}
    </div>
  );
}
