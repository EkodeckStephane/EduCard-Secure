import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode } from 'react';

export function PageTransition({ children, tabKey }: { children: ReactNode; tabKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
