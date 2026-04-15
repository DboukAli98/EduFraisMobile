import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { ThemedText } from '../../components';

interface AgentAreaPickerProps {
  selectedArea: string;
  suggestions: string[];
  onSelectArea: (area: string) => void;
  title?: string;
  description?: string;
}

const AgentAreaPicker: React.FC<AgentAreaPickerProps> = ({
  selectedArea,
  suggestions,
  onSelectArea,
  title = 'Suggested Areas',
  description = 'Use a neighborhood, district, or route coverage label.',
}) => {
  const { theme } = useTheme();

  const normalizedSuggestions = useMemo(() => {
    const values = [...suggestions];
    const trimmedSelectedArea = selectedArea.trim();

    if (trimmedSelectedArea) {
      values.unshift(trimmedSelectedArea);
    }

    return Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ).slice(0, 8);
  }, [selectedArea, suggestions]);

  return (
    <View style={styles.container}>
      <ThemedText variant="bodySmall" color={theme.colors.textSecondary} style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.description}>
        {description}
      </ThemedText>

      {normalizedSuggestions.length === 0 ? (
        <View
          style={[
            styles.emptyHint,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            Save one area and it will appear here as a quick pick for the next agents.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.chipsWrap}>
          {normalizedSuggestions.map((area) => {
            const isSelected = area.trim().toLowerCase() === selectedArea.trim().toLowerCase();

            return (
              <Pressable
                key={area}
                onPress={() => onSelectArea(area)}
                style={[
                  styles.chip,
                  {
                    borderRadius: theme.borderRadius.full,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.borderLight,
                    backgroundColor: isSelected ? theme.colors.primary + '12' : theme.colors.surface,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                  style={styles.chipText}
                >
                  {area}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: -4,
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  description: {
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontWeight: '600',
  },
  emptyHint: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

export default AgentAreaPicker;
