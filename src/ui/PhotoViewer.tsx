import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet } from 'react-native';

/** Wraps a photo so tapping it opens a full size view. Tap again, or the backdrop, to close. */
export function ViewablePhoto({ uri, children }: { uri: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="View photo full size" onPress={() => setOpen(true)}>
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.full} resizeMode="contain" accessibilityLabel="Full size photo" />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: {
    width: '100%',
    height: '100%',
  },
});
