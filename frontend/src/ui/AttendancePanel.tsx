import { Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { DataTable } from './DataTable';
import { QRScannerModule } from './QRScannerModule';
import { SearchSelect, SelectOption, useToast } from './WorkflowComponents';

export function AttendancePanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const language = useLanguage();
  const notify = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [cards, setCards] = useState<SelectOption[]>([]);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [card, setCard] = useState<SelectOption | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [corrections, setCorrections] = useState<Array<Record<string, unknown>>>([]);
  const [newStatus, setNewStatus] = useState('LATE');
  const [reason, setReason] = useState('');
  const [qrResult, setQrResult] = useState<Record<string, unknown> | null>(null);

  async function load() {
    try {
      setRows(await api.attendance(school ? `?school_id=${school.id}` : ''));
      if (can('attendance:read')) setCorrections(await api.attendanceCorrections());
    } catch {
      onError(language === 'fr' ? 'Lecture des présences refusée.' : 'Attendance access denied.');
    }
  }

  useEffect(() => {
    Promise.all([api.schools(), api.cards()]).then(([schoolRows, cardRows]) => {
      const schoolOptions = schoolRows.map((row) => ({
        id: Number(row.school_id ?? row.id),
        label: String(row.school ?? row.name),
        subtitle: String(row.subdivision ?? ''),
        raw: row,
      }));
      setSchools(schoolOptions);
      if (schoolOptions.length === 1) setSchool(schoolOptions[0]);
      setCards(cardRows.filter((item) => item.status === 'ACTIVE').map((item) => ({
        id: item.id,
        label: item.serial_number,
        subtitle: language === 'fr' ? `Carte active · élève ${item.student_id}` : `Active card · student ${item.student_id}`,
        raw: item as unknown as Record<string, unknown>,
      })));
    }).catch(() => onError(language === 'fr' ? 'Chargement des présences refusé.' : 'Attendance loading denied.'));
    void load();
  }, [language]);

  async function point(eventType: 'ENTRY' | 'EXIT') {
    if (!school || !card) return;
    try {
      if (eventType === 'ENTRY') await api.checkIn({ card_id: card.id, school_id: school.id, event_type: 'ENTRY', source: 'CARD' });
      else await api.checkOut({ card_id: card.id, school_id: school.id, event_type: 'EXIT', source: 'CARD' });
      notify(eventType === 'ENTRY'
        ? (language === 'fr' ? 'Entrée enregistrée.' : 'Entry recorded.')
        : (language === 'fr' ? 'Sortie enregistrée.' : 'Exit recorded.'), 'success');
      await load();
    } catch {
      onError(language === 'fr' ? 'Pointage refusé.' : 'Attendance event denied.');
    }
  }

  async function verifyAttendanceQr(payload: string) {
    try {
      const result = await api.verifyQr(payload);
      setQrResult(result);
      if (result.result === 'valide' && result.card_id) {
        setCard(cards.find((option) => option.id === Number(result.card_id)) ?? null);
        notify(language === 'fr' ? 'Carte valide sélectionnée pour le pointage.' : 'Valid card selected for attendance.', 'success');
      }
    } catch {
      onError(language === 'fr' ? 'Vérification QR refusée.' : 'QR verification denied.');
    }
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <section className="dashboardTopbar">
        <div>
          <Typography variant="h6">{language === 'fr' ? 'Pointage de présence' : 'Attendance check'}</Typography>
          <Typography color="text.secondary">
            {new Date().toLocaleDateString()} · {rows.filter((row) => row.event_type === 'ENTRY').length} {language === 'fr' ? 'entrées pointées' : 'entries recorded'}
          </Typography>
        </div>
        <div className="attendanceContext">
          <SearchSelect label={language === 'fr' ? 'Établissement' : 'School'} options={schools} value={school} onChange={setSchool} disabled={schools.length === 1} />
        </div>
      </section>
      <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }}>
        <SearchSelect label={language === 'fr' ? 'Rechercher une carte active' : 'Search for an active card'} options={cards} value={card} onChange={setCard} />
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          {can('attendance:create') && <Button variant="contained" onClick={() => void point('ENTRY')}>{language === 'fr' ? 'Entrée' : 'Entry'}</Button>}
          {can('attendance:create') && <Button variant="outlined" onClick={() => void point('EXIT')}>{language === 'fr' ? 'Sortie' : 'Exit'}</Button>}
          <Button variant="outlined" startIcon={<RefreshCw size={18} />} onClick={() => void load()}>{language === 'fr' ? 'Actualiser' : 'Refresh'}</Button>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">{language === 'fr' ? 'Scanner une carte pour le pointage' : 'Scan a card for attendance'}</Typography>
        <QRScannerModule onVerify={verifyAttendanceQr} result={qrResult} />
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}><DataTable rows={rows} onRow={setSelected} /></Paper>
      {can('attendance:correct') && selected && (
        <Paper component="form" variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }} onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim().length < 10) return;
          api.correctAttendance(Number(selected.id), { new_value: newStatus, reason }).then(() => {
            notify(language === 'fr' ? 'Correction soumise à validation.' : 'Correction submitted for approval.', 'success');
            setReason('');
            return load();
          }).catch(() => onError(language === 'fr' ? 'Correction refusée.' : 'Correction denied.'));
        }}>
          <Typography variant="h6">{language === 'fr' ? 'Correction de présence' : 'Attendance correction'}</Typography>
          <Typography>{language === 'fr' ? 'Événement sélectionné' : 'Selected event'} : {String(selected.event_type)} · {new Date(String(selected.event_time)).toLocaleString()}</Typography>
          <TextField select label={language === 'fr' ? 'Nouveau statut' : 'New status'} value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
            <MenuItem value="ENTRY">{language === 'fr' ? 'Présent(e)' : 'Present'}</MenuItem>
            <MenuItem value="ABSENCE_JUSTIFIED">{language === 'fr' ? 'Absent(e) justifié(e)' : 'Excused absence'}</MenuItem>
            <MenuItem value="ABSENCE">{language === 'fr' ? 'Absent(e) non justifié(e)' : 'Unexcused absence'}</MenuItem>
            <MenuItem value="LATE">{language === 'fr' ? 'En retard' : 'Late'}</MenuItem>
            <MenuItem value="EARLY_EXIT">{language === 'fr' ? 'Sortie anticipée' : 'Early exit'}</MenuItem>
          </TextField>
          <TextField multiline minRows={3} label={language === 'fr' ? 'Motif obligatoire, 10 caractères minimum' : 'Required reason, at least 10 characters'} value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button type="submit" variant="contained" disabled={reason.trim().length < 10}>{language === 'fr' ? 'Soumettre la correction' : 'Submit correction'}</Button>
        </Paper>
      )}
      {corrections.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">{language === 'fr' ? 'Corrections en attente' : 'Pending corrections'}</Typography>
          <DataTable rows={corrections} onRow={(row) => {
            if (can('attendance:validate') && row.status === 'PENDING_VALIDATION' && window.confirm(language === 'fr' ? 'Valider cette correction ?' : 'Approve this correction?')) {
              api.approveAttendance(Number(row.attendance_event_id)).then(load).catch(() => onError(language === 'fr' ? 'Validation refusée.' : 'Approval denied.'));
            }
          }} />
        </Paper>
      )}
    </Stack>
  );
}
