import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DiscoverScreen, MatchCandidate } from './DiscoverScreen';
import { AdvancedFilters } from './AdvancedSearchScreen';

type ExploreScreenProps = {
  token: string;
  name: string;
  apiBaseUrl: string;
  onCardPress?: (match: MatchCandidate) => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenWallet?: () => void;
  onOpenLikesInbox?: () => void;
  onOpenMatches?: () => void;
  onOpenConversations?: () => void;
  onOpenAdvancedSearch?: () => void;
  filters?: AdvancedFilters;
  preferredTab?: 'onGrid' | 'offGrid';
};

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  token,
  apiBaseUrl,
  onCardPress,
  onOpenAdvancedSearch,
  onOpenWallet,
  filters,
  preferredTab,
}) => {
  return (
    <View style={styles.container}>
      <DiscoverScreen
        token={token}
        apiBaseUrl={apiBaseUrl}
        onCardPress={onCardPress}
        onOpenFilters={onOpenAdvancedSearch}
        onOpenWallet={onOpenWallet}
        filters={filters}
        preferredTab={preferredTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
