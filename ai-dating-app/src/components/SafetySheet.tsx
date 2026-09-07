import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Block / Report in the app's own style instead of the OS alert (board 18),
 * with the reason list from the board (19). Two steps: what to do, then why.
 */
export const REPORT_REASONS = [
  'Spam',
  'Inappropriate behaviour',
  'Fake profile',
  'Harassment / Bullying',
  'Hate or offensive content',
  'Scam / Fraud',
  'Something else',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

type Props = {
  visible: boolean;
  name: string;
  onClose: () => void;
  onBlock?: () => void;
  onReport?: (reason: ReportReason) => void;
  /** Open straight on the reasons list (e.g. from a "Report" menu item). */
  startAtReasons?: boolean;
};

export const SafetySheet: React.FC<Props> = ({ visible, name, onClose, onBlock, onReport, startAtReasons }) => {
  const theme = useTheme();
  const [step, setStep] = useState<'actions' | 'reasons'>(startAtReasons ? 'reasons' : 'actions');
  const [reason, setReason] = useState<ReportReason | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(startAtReasons ? 'reasons' : 'actions');
      setReason(null);
    }
  }, [visible, startAtReasons]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]} onPress={() => {}}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

          {step === 'actions' ? (
            <>
              <View style={styles.titleRow}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 107, 107, 0.12)' }]}>
                  <Feather name="shield" size={18} color={theme.colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="h2" style={{ color: theme.colors.text }}>Safety</Typography>
                  <Typography variant="small" style={{ color: theme.colors.muted }}>
                    Manage your interaction with {name}.
                  </Typography>
                </View>
              </View>

              {onReport ? (
                <TouchableOpacity
                  style={[styles.actionRow, { borderColor: theme.colors.border }]}
                  onPress={() => setStep('reasons')}
                  activeOpacity={0.8}
                >
                  <Feather name="flag" size={18} color={theme.colors.text} />
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Report {name}</Typography>
                    <Typography variant="tiny" style={{ color: theme.colors.muted }}>They will not know it was you.</Typography>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              ) : null}

              {onBlock ? (
                <TouchableOpacity
                  style={[styles.actionRow, { borderColor: 'rgba(255, 107, 107, 0.4)' }]}
                  onPress={() => { onClose(); onBlock(); }}
                  activeOpacity={0.8}
                >
                  <Feather name="slash" size={18} color={theme.colors.error} />
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyStrong" style={{ color: theme.colors.error }}>Block {name}</Typography>
                    <Typography variant="tiny" style={{ color: theme.colors.muted }}>Removes the chat and hides you both from each other.</Typography>
                  </View>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.8}>
                <Typography variant="bodyStrong" style={{ color: theme.colors.muted }}>Cancel</Typography>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Typography variant="h2" style={{ color: theme.colors.text }}>
                Why are you reporting this profile?
              </Typography>
              <View style={styles.reasonList}>
                {REPORT_REASONS.map((item) => {
                  const selected = reason === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.reasonRow,
                        {
                          borderColor: selected ? theme.colors.neonGreen : theme.colors.border,
                          backgroundColor: selected ? 'rgba(173, 255, 26, 0.12)' : 'transparent',
                        },
                      ]}
                      onPress={() => setReason(item)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radio, { borderColor: selected ? theme.colors.neonGreen : theme.colors.muted }]}>
                        {selected ? <View style={[styles.radioDot, { backgroundColor: theme.colors.neonGreen }]} /> : null}
                      </View>
                      <Typography variant="body" style={{ color: theme.colors.text, flex: 1 }}>{item}</Typography>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.submit, { backgroundColor: reason ? theme.colors.neonGreen : theme.colors.border }]}
                disabled={!reason}
                onPress={() => { if (reason && onReport) { onClose(); onReport(reason); } }}
                activeOpacity={0.85}
              >
                <Typography variant="bodyStrong" style={{ color: reason ? theme.colors.deepBlack : theme.colors.muted }}>
                  Submit report
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancel} onPress={startAtReasons ? onClose : () => setStep('actions')} activeOpacity={0.8}>
                <Typography variant="bodyStrong" style={{ color: theme.colors.muted }}>{startAtReasons ? 'Cancel' : 'Back'}</Typography>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  reasonList: {
    gap: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  submit: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
});
