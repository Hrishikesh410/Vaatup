import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addComment, removeComment } from '@/application/comment-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useComments } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { spacing } from '@/theme/theme';
import type { ExpenseId } from '@/types/expense';
import type { ParticipantId } from '@/types/participant';
import { formatRelativeDay } from '@/utils/date';
import { tapWarning } from '@/utils/haptics';

export interface CommentThreadProps {
  expenseId: ExpenseId;
  /** Who anything typed here is attributed to — the signed-in user. */
  authorParticipantId: ParticipantId;
}

/**
 * Notes people add to an expense after the fact — "I'll pay you Friday", or
 * what the unlabelled line on the receipt was.
 */
export function CommentThread({ expenseId, authorParticipantId }: CommentThreadProps) {
  const { refresh } = useRefresh();
  const comments = useComments(expenseId);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const post = async () => {
    const body = text.trim();
    if (body === '') return;

    setSending(true);
    setError(null);
    try {
      await addComment(expenseId, authorParticipantId, body);
      setText('');
      refresh();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not add that comment.'));
    } finally {
      setSending(false);
    }
  };

  const discard = async (id: string) => {
    await removeComment(id);
    refresh();
  };

  return (
    <Card>
      <SectionLabel>Comments</SectionLabel>

      {comments.data.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <View style={styles.commentHeader}>
            <AppText variant="caption" weight="600">
              {comment.authorName}
            </AppText>
            <AppText variant="caption" muted>
              {formatRelativeDay(comment.createdAt)}
            </AppText>
          </View>
          <AppText variant="body">{comment.comment}</AppText>
          <PrimaryButton
            label="Delete"
            variant="ghost"
            size="sm"
            tone="danger"
            onPress={() => discard(comment.id)}
            accessibilityLabel="Delete this comment"
            style={styles.deleteButton}
          />
        </View>
      ))}

      <TextField
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        placeholder="Add a comment"
        multiline
        maxLength={500}
        error={error ?? undefined}
      />
      <PrimaryButton
        label={sending ? 'Adding…' : 'Add comment'}
        variant="secondary"
        size="sm"
        disabled={sending || text.trim() === ''}
        onPress={post}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  comment: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    alignSelf: 'flex-start',
  },
});
