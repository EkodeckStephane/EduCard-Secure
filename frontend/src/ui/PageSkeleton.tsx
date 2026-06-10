import { Box, Skeleton, Stack } from '@mui/material';
import { motion } from 'framer-motion';

export function PageSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <Stack sx={{ gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton variant="rectangular" width={220} height={32} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
        </Box>
        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
        <Stack sx={{ gap: 1 }}>
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} variant="rectangular" height={44} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      </Stack>
    </motion.div>
  );
}
