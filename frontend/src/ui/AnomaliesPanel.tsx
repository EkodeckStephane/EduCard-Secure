import { Paper, Typography } from '@mui/material';
import { useLanguage } from '../i18n';

export function AnomaliesPanel() {
  const language = useLanguage();
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6">{language === 'fr' ? 'Anomalies' : 'Anomalies'}</Typography>
      <Typography color="text.secondary">
        {language === 'fr'
          ? 'Les anomalies QR, cartes, présence, paiements et accès hors périmètre sont journalisées côté serveur.'
          : 'QR, card, attendance, payment and out-of-scope access anomalies are logged by the server.'}
      </Typography>
    </Paper>
  );
}
