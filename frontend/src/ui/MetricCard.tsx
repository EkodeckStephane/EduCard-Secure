import { Assessment, CreditCard, Payments, Security, School, Warning } from '@mui/icons-material';
import { Box, Card, Divider, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { localizeText, useLanguage } from '../i18n';

const icons: Record<string, ReactNode> = {
  card: <CreditCard />,
  payment: <Payments />,
  school: <School />,
  security: <Security />,
  warning: <Warning />,
  default: <Assessment />,
};

type Props = {
  label: string;
  value: unknown;
};

export function MetricCard({ label, value }: Props) {
  const language = useLanguage();
  const normalized = label.toLowerCase();
  const iconKey = normalized.includes('carte')
    ? 'card'
    : normalized.includes('paiement') || normalized.includes('transaction')
      ? 'payment'
      : normalized.includes('etablissement') || normalized.includes('eleve') || normalized.includes('inscription')
        ? 'school'
        : normalized.includes('alerte') || normalized.includes('incident')
          ? 'warning'
          : normalized.includes('connexion') || normalized.includes('acces') || normalized.includes('qr')
            ? 'security'
            : 'default';

  return (
    <Card sx={{ overflow: 'visible', height: '100%' }}>
      <Stack direction="row" sx={{ px: 2, pt: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 50,
            height: 50,
            mt: -3.5,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: iconKey === 'warning' ? 'warning.main' : iconKey === 'security' ? 'secondary.main' : 'primary.main',
            boxShadow: 3,
          }}
        >
          {icons[iconKey]}
        </Box>
        <Box sx={{ textAlign: 'right', minWidth: 0, pl: 1 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{String(value ?? 0)}</Typography>
        </Box>
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1.75, display: 'block' }}>
        {localizeText(language, 'Donnees agregees selon votre perimetre')}
      </Typography>
    </Card>
  );
}
