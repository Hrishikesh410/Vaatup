import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { avatar, control, opacity, radius, spacing, useTheme } from '@/theme/theme';

/** Same name always gets the same colour, so a person looks consistent. */
function avatarColor(name: string, palette: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return palette[hash % palette.length];
}

function firstLetterOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export interface PersonRowProps {
  name: string;
  subtitle?: string;
  /** Amount, input, or action rendered on the trailing edge. */
  right?: ReactNode;
  /** Rendered under the row, e.g. a per-person WhatsApp button. */
  below?: ReactNode;
  onPress?: () => void;
  subtitleTone?: 'muted' | 'danger' | 'accent';
  /**
   * Crosses out the name and fades the avatar. Used for a paid share, alongside
   * a subtitle that says so, since colour and strike-through alone are not
   * announced by a screen reader.
   */
  struck?: boolean;
}

const SUBTITLE_TONE_KEYS = {
  muted: 'textMuted',
  danger: 'danger',
  accent: 'accent',
} as const;

export function PersonRow({
  name,
  subtitle,
  right,
  below,
  onPress,
  subtitleTone = 'muted',
  struck = false,
}: PersonRowProps) {
  const { colors } = useTheme();

  const identity = (
    <>
      <View
        style={[
          styles.avatar,
          { backgroundColor: avatarColor(name, colors.avatarPalette) },
          struck ? styles.faded : null,
        ]}
      >
        <AppText variant="body" weight="700" color={colors.avatarInk}>
          {firstLetterOf(name)}
        </AppText>
      </View>
      <View style={styles.identity}>
        <AppText variant="label" numberOfLines={1} strikethrough={struck} muted={struck}>
          {name}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color={colors[SUBTITLE_TONE_KEYS[subtitleTone]]}
            weight={subtitleTone === 'muted' ? undefined : '600'}
            numberOfLines={1}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Only the name area is pressable, so a button in `right` never nests inside it. */}
        {onPress ? (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={name}
            accessibilityHint="Edit this person"
            style={({ pressed }) => [styles.identityPress, pressed ? styles.pressed : null]}
          >
            {identity}
          </Pressable>
        ) : (
          identity
        )}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {below}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: control.md,
  },
  avatar: {
    width: avatar.md,
    height: avatar.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: control.md,
  },
  identity: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  faded: {
    opacity: opacity.hint,
  },
  pressed: {
    opacity: opacity.muted,
  },
});
