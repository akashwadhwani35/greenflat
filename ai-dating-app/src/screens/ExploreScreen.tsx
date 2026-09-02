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
  onOpenAISearch?: () => void;
  filters?: AdvancedFilters;
  preferredTab?: 'onGrid' | 'offGrid';
  pendingAISearchCharge?: boolean;
  onConsumeAISearchCharge?: () => void;
  likedIds?: Set<number>;
  passedIds?: Set<number>;
};

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  token,
  apiBaseUrl,
  onCardPress,
  onOpenAdvancedSearch,
  onOpenAISearch,
  onOpenWallet,
  filters,
  preferredTab,
  pendingAISearchCharge,
  onConsumeAISearchCharge,
  likedIds,
  passedIds,
}) => {
  return (
    <View style={styles.container}>
      <DiscoverScreen
        token={token}
        apiBaseUrl={apiBaseUrl}
        onCardPress={onCardPress}
        onOpenFilters={onOpenAdvancedSearch}
        onOpenWallet={onOpenWallet}
        onOpenAISearch={onOpenAISearch}
        filters={filters}
        preferredTab={preferredTab}
        pendingAISearchCharge={pendingAISearchCharge}
        onConsumeAISearchCharge={onConsumeAISearchCharge}
        likedIds={likedIds}
        passedIds={passedIds}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
