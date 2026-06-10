import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { CreditCard } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { QRScannerModule } from './QRScannerModule';
import { SearchSelect, SelectOption } from './WorkflowComponents';

export function QrPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const language = useLanguage();
  const [cards, setCards] = useState<SelectOption[]>([]);
  const [card, setCard] = useState<SelectOption | null>(null);
  const [payload, setPayload] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.cards()
      .then((rows) => setCards(rows.filter((item) => item.status === 'ACTIVE').map((item) => ({ id: item.id, label: item.serial_number, subtitle: item.status, raw: item as unknown as Record<string, unknown> }))))
      .catch(() => onError(language === 'fr' ? 'Lecture des cartes refusée.' : 'Card access denied.'));
  }, [language, onError]);

  const verify = useCallback(async (value: string) => {
    try {
      setResult(await api.verifyQr(value));
    } catch {
      onError(language === 'fr' ? 'Vérification QR refusée.' : 'QR verification denied.');
    }
  }, [language, onError]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <Paper component="form" variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }} onSubmit={async (event) => {
        event.preventDefault();
        try {
          if (!card) return;
          const response = await api.generateQr(card.id, 60);
          setPayload(String(response.payload ?? ''));
          setResult(response);
        } catch {
          onError(language === 'fr' ? 'Génération QR refusée.' : 'QR generation denied.');
        }
      }}>
        <Typography variant="h6">{language === 'fr' ? 'Génération QR' : 'QR generation'}</Typography>
        <SearchSelect label={language === 'fr' ? 'Carte active' : 'Active card'} options={cards} value={card} onChange={setCard} />
        {can('card:issue') && <Button type="submit" variant="contained" startIcon={<CreditCard size={18} />}>{language === 'fr' ? 'Générer' : 'Generate'}</Button>}
        <textarea value={payload} readOnly placeholder={language === 'fr' ? 'Le payload sera généré ici' : 'The payload will be generated here'} style={{ cursor: 'default', opacity: payload ? 1 : 0.5 }} />
        {payload && <Typography variant="caption" color="text.secondary">{language === 'fr' ? 'Payload en lecture seule — copier pour vérification manuelle.' : 'Read-only payload — copy it for manual verification.'}</Typography>}
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack sx={{ gap: 1.5 }}>
          <Typography variant="h6">{language === 'fr' ? 'Vérification QR' : 'QR verification'}</Typography>
          <QRScannerModule onVerify={verify} result={result} />
        </Stack>
      </Paper>
    </Box>
  );
}
