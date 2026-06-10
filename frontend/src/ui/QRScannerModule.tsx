import { Alert, Box, Button, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Cameraswitch, QrCodeScanner } from '@mui/icons-material';
import { BrowserQRCodeReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';

export function QRScannerModule({ onVerify, result }: { onVerify: (payload: string) => Promise<void>; result: Record<string, unknown> | null }) {
  const language = useLanguage();
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en;
  const [mode, setMode] = useState(window.matchMedia('(max-width: 700px)').matches ? 0 : 1);
  const [payload, setPayload] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPayload = useRef('');

  useEffect(() => {
    if (mode !== 0 || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let active = true;
    setScanning(true);
    reader.decodeFromVideoDevice(undefined, videoRef.current, async (decoded) => {
      const text = decoded?.getText();
      if (!active || !text || text === lastPayload.current) return;
      lastPayload.current = text;
      setPayload(text);
      await onVerify(text);
      window.setTimeout(() => { lastPayload.current = ''; }, 3000);
    }).catch(() => {
      setCameraError(tr(
        "L'accès à la caméra est indisponible. Utilisez la saisie manuelle.",
        'Camera access is unavailable. Use manual input.',
      ));
      setMode(1);
    }).finally(() => setScanning(false));
    return () => {
      active = false;
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [language, mode, onVerify]);

  const status = String(result?.result ?? '');
  const normalizedStatus = status.toLowerCase();
  const valid = ['valide', 'valid'].includes(normalizedStatus);
  const suspended = normalizedStatus.includes('suspend');

  return (
    <Stack sx={{ gap: 2 }}>
      <Tabs value={mode} onChange={(_, value) => setMode(value)}>
        <Tab icon={<QrCodeScanner />} iconPosition="start" label={tr('Scanner', 'Scan')} />
        <Tab icon={<Cameraswitch />} iconPosition="start" label={tr('Saisie manuelle', 'Manual input')} />
      </Tabs>
      {cameraError && <Alert severity="warning">{cameraError}</Alert>}
      {mode === 0 ? (
        <Box className="qrScanner">
          <video ref={videoRef} muted playsInline />
          <div className="scanTarget" />
          <Typography>{scanning ? tr('Initialisation de la caméra...', 'Initializing camera...') : tr('Placez le QR dans le cadre', 'Place the QR code inside the frame')}</Typography>
        </Box>
      ) : (
        <Stack sx={{ gap: 1.5 }}>
          <TextField multiline minRows={5} label={tr('Contenu QR', 'QR payload')} value={payload} onChange={(event) => setPayload(event.target.value)} />
          <Button variant="contained" onClick={() => void onVerify(payload)} disabled={payload.length < 10}>{tr('Vérifier', 'Verify')}</Button>
        </Stack>
      )}
      {result && (
        <Alert className="qrResult" severity={valid ? 'success' : suspended ? 'warning' : 'error'}>
          <Typography variant="h6">
            {valid ? tr('CARTE VALIDE', 'VALID CARD') : suspended ? tr('CARTE SUSPENDUE', 'SUSPENDED CARD') : tr('CARTE INVALIDE', 'INVALID CARD')}
          </Typography>
          <Typography>{tr('Résultat', 'Result')} : {status || tr('anomalie', 'anomaly')}</Typography>
          {Boolean(result.reason) && <Typography>{tr('Motif', 'Reason')} : {String(result.reason)}</Typography>}
        </Alert>
      )}
    </Stack>
  );
}
