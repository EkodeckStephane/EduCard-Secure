import { Alert, Box, Button, Checkbox, FormControlLabel, MobileStepper, Paper, Stack, TextField, Typography } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight, PersonAdd } from '@mui/icons-material';
import ReactCrop, { centerCrop, makeAspectCrop, PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useEffect, useMemo, useState } from 'react';
import { api, Student } from '../api';
import { useLanguage } from '../i18n';
import { LoadingButton, SearchSelect, SelectOption, useToast } from './WorkflowComponents';

type Draft = {
  last_name: string;
  first_name: string;
  birth_date: string;
  gender: string;
  school: SelectOption | null;
  year: SelectOption | null;
  classroom: SelectOption | null;
};

const emptyDraft: Draft = {
  last_name: '',
  first_name: '',
  birth_date: '',
  gender: '',
  school: null,
  year: null,
  classroom: null,
};

function loadDraft(): Draft {
  try {
    const stored = sessionStorage.getItem('educard-student-draft');
    return stored ? { ...emptyDraft, ...JSON.parse(stored) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

async function croppedBlob(image: HTMLImageElement, crop: PercentCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const width = image.width * crop.width / 100;
  const height = image.height * crop.height / 100;
  canvas.width = Math.max(1, Math.round(width * scaleX));
  canvas.height = Math.max(1, Math.round(height * scaleY));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(
    image,
    image.width * crop.x / 100 * scaleX,
    image.height * crop.y / 100 * scaleY,
    width * scaleX,
    height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Crop failed')), 'image/jpeg', 0.9));
}

export function StudentCreationWizard({ canRequestCard, onCompleted }: { canRequestCard: boolean; onCompleted: (student: Student) => void }) {
  const language = useLanguage();
  const notify = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [years, setYears] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [duplicates, setDuplicates] = useState<Array<Record<string, unknown>>>([]);
  const [decisions, setDecisions] = useState<Record<number, 'distinct' | 'same'>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [requestCard, setRequestCard] = useState(canRequestCard);
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState<PercentCrop>();
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [result, setResult] = useState<Student | null>(null);

  useEffect(() => {
    sessionStorage.setItem('educard-student-draft', JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    Promise.all([api.schools(), api.schoolYears()]).then(([schoolRows, yearRows]) => {
      setSchools(schoolRows.map((row) => ({
        id: Number(row.school_id ?? row.id),
        label: String(row.school ?? row.name),
        subtitle: `${String(row.subdivision ?? '')} · ${String(row.school_type ?? '')}`,
        badge: String(row.status ?? ''),
        raw: row,
      })));
      const options = yearRows.map((row) => ({ id: Number(row.id), label: String(row.code), subtitle: String(row.status), raw: row }));
      setYears(options);
      if (options.length === 1) setDraft((current) => ({ ...current, year: options[0] }));
    }).catch(() => notify('Impossible de charger les référentiels.', 'error'));
  }, [notify]);

  useEffect(() => {
    if (!draft.school || !draft.year) {
      setClasses([]);
      return;
    }
    api.classrooms(draft.school.id, draft.year.id).then((rows) => setClasses(rows.map((row) => ({
      id: Number(row.id),
      label: String(row.label),
      subtitle: `${String(row.grade_level ?? '')} · ${row.remaining_capacity ?? '—'} places disponibles`,
      badge: Number(row.remaining_capacity ?? 1) === 0 ? 'Complète' : undefined,
      raw: row,
    })))).catch(() => notify('Impossible de charger les classes.', 'error'));
  }, [draft.school, draft.year, notify]);

  useEffect(() => {
    if (draft.last_name.length < 2 || draft.first_name.length < 2 || !draft.birth_date) return;
    const timer = window.setTimeout(() => {
      api.findDuplicates(draft.last_name, draft.first_name, draft.birth_date, draft.school?.id)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft.birth_date, draft.first_name, draft.last_name, draft.school]);

  const identityValid = useMemo(() => {
    const namesValid = /^[^\d]{2,80}$/.test(draft.last_name.trim()) && /^[^\d]{2,80}$/.test(draft.first_name.trim());
    if (!namesValid || !draft.birth_date || !draft.gender) return false;
    const age = (Date.now() - new Date(draft.birth_date).getTime()) / 31557600000;
    return age >= 5 && age <= 25;
  }, [draft]);
  const attachmentValid = Boolean(draft.school && draft.year && draft.classroom);
  const duplicatesHandled = duplicates.every((candidate) => decisions[Number(candidate.student_id)]);
  const canNext = step === 0 ? identityValid : step === 1 ? attachmentValid : step === 2 ? duplicatesHandled : confirmed;

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify('La photo doit être un JPEG ou PNG de 5 Mo maximum.', 'warning');
      return;
    }
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoBlob(null);
  }

  async function validateCrop() {
    if (!imageElement || !crop) return;
    setPhotoBlob(await croppedBlob(imageElement, crop));
    notify('Recadrage enregistré.', 'success');
  }

  async function submit() {
    if (!draft.school || !draft.year || !draft.classroom) return;
    setLoading(true);
    try {
      const student = await api.createStudent({
        last_name: draft.last_name.trim(),
        first_name: draft.first_name.trim(),
        birth_date: draft.birth_date,
        gender: draft.gender,
        school_id: draft.school.id,
        classroom_id: draft.classroom.id,
      });
      if (photoBlob) {
        try {
          await api.uploadStudentPhoto(student.id, photoBlob);
        } catch {
          notify("Élève créé, mais la photo n'a pas pu être enregistrée.", 'warning');
        }
      }
      await api.enroll({
        student_id: student.id,
        school_id: draft.school.id,
        classroom_id: draft.classroom.id,
        school_year_id: draft.year.id,
        status: 'ACTIVE',
      });
      if (requestCard && canRequestCard) await api.requestCard(student.id);
      setResult(student);
      sessionStorage.removeItem('educard-student-draft');
      notify(`Élève créé. Matricule : ${student.student_number}`, 'success');
      onCompleted(student);
    } catch {
      notify("L'opération n'a pas pu être terminée. Les étapes déjà créées ne seront pas répétées automatiquement.", 'error');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Paper className="workflowResult" variant="outlined">
        <PersonAdd color="success" sx={{ fontSize: 52 }} />
        <Typography variant="h5">Inscription créée</Typography>
        <Typography>Matricule : <strong>{result.student_number}</strong></Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={() => onCompleted(result)}>Voir la fiche élève</Button>
          <Button onClick={() => { setResult(null); setStep(0); setDraft(emptyDraft); setConfirmed(false); }}>Inscrire un autre élève</Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="studentWizard" variant="outlined">
      <Box>
        <Typography variant="h5">Inscription élève guidée</Typography>
        <Typography color="text.secondary">Identité · Rattachement · Vérification · Confirmation</Typography>
      </Box>
      <MobileStepper variant="progress" steps={4} position="static" activeStep={step} nextButton={<span>Étape {step + 1} sur 4</span>} backButton={<span />} />

      {step === 0 && (
        <Stack sx={{ gap: 2 }}>
          <Typography variant="h6">1. Identité</Typography>
          <TextField required label="Nom de famille" value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} />
          <TextField required label="Prénom(s)" value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} />
          <TextField required type="date" label="Date de naissance" slotProps={{ inputLabel: { shrink: true } }} value={draft.birth_date} onChange={(event) => setDraft({ ...draft, birth_date: event.target.value })} />
          <label className="fieldLabel">
            Sexe
            <select required value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value })}>
              <option value="" />
              <option value="F">Féminin</option>
              <option value="M">Masculin</option>
            </select>
          </label>
          <Box className="photoCropper">
            <Button component="label" variant="outlined">Choisir une photo<input hidden type="file" accept="image/jpeg,image/png" onChange={(event) => void choosePhoto(event.target.files?.[0])} /></Button>
            {photoUrl && (
              <>
                <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} aspect={3 / 4}>
                  <img
                    src={photoUrl}
                    alt="Aperçu"
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      setImageElement(image);
                      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 65 }, 3 / 4, image.width, image.height), image.width, image.height));
                    }}
                  />
                </ReactCrop>
                <Button onClick={() => void validateCrop()}>Valider le recadrage</Button>
              </>
            )}
          </Box>
          {!photoBlob && <Alert severity="warning">La photo est fortement recommandée. La carte ne pourra pas être émise sans elle.</Alert>}
          {duplicates.length > 0 && <Alert severity="info">{duplicates.length} élève(s) similaire(s) détecté(s). Vous les examinerez à l'étape 3.</Alert>}
        </Stack>
      )}

      {step === 1 && (
        <Stack sx={{ gap: 2 }}>
          <Typography variant="h6">2. Rattachement</Typography>
          <SearchSelect label="Établissement" options={schools} value={draft.school} onChange={(school) => setDraft({ ...draft, school, classroom: null })} />
          <SearchSelect label="Année scolaire" options={years} value={draft.year} onChange={(year) => setDraft({ ...draft, year, classroom: null })} />
          <SearchSelect label="Classe" options={classes} value={draft.classroom} onChange={(classroom) => setDraft({ ...draft, classroom })} disabled={!draft.school || !draft.year} />
          {draft.classroom && <TextField label="Niveau scolaire" value={String(draft.classroom.raw?.grade_level ?? '')} disabled />}
        </Stack>
      )}

      {step === 2 && (
        <Stack sx={{ gap: 2 }}>
          <Typography variant="h6">3. Vérification des doublons</Typography>
          {!duplicates.length && <Alert severity="success">Aucun doublon potentiel détecté.</Alert>}
          {duplicates.map((candidate) => (
            <Paper key={String(candidate.student_id)} variant="outlined" sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{String(candidate.full_name)}</Typography>
              <Typography variant="body2">Matricule : {String(candidate.student_number)} · Similarité : {String(candidate.score)} %</Typography>
              <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
                <Button color="warning" onClick={() => {
                  const id = Number(candidate.student_id);
                  void api.confirmDuplicate(id);
                  setDecisions({ ...decisions, [id]: 'same' });
                  notify('Création annulée : ouvrez la fiche de l’élève existant.', 'warning');
                }}>C'est le même élève</Button>
                <Button variant="outlined" onClick={() => {
                  const id = Number(candidate.student_id);
                  setDecisions({ ...decisions, [id]: 'distinct' });
                }}>Dossiers distincts</Button>
              </Stack>
            </Paper>
          ))}
          {duplicates.length > 0 && !duplicatesHandled && (
            <Alert severity="info">
              {language === 'fr'
                ? 'Examinez chaque dossier similaire et indiquez s’il s’agit du même élève ou de dossiers distincts pour continuer.'
                : 'Review every similar record and mark it as the same student or a distinct record to continue.'}
            </Alert>
          )}
        </Stack>
      )}

      {step === 3 && (
        <Stack sx={{ gap: 2 }}>
          <Typography variant="h6">4. Confirmation</Typography>
          <div className="summaryGrid">
            <span>Élève</span><strong>{draft.first_name} {draft.last_name}</strong>
            <span>Date de naissance</span><strong>{draft.birth_date}</strong>
            <span>Établissement</span><strong>{draft.school?.label}</strong>
            <span>Classe</span><strong>{draft.classroom?.label}</strong>
            <span>Année</span><strong>{draft.year?.label}</strong>
          </div>
          <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label="Je confirme que les informations saisies sont exactes." />
          {canRequestCard && <FormControlLabel control={<Checkbox checked={requestCard} onChange={(event) => setRequestCard(event.target.checked)} />} label="Créer et demander la carte immédiatement" />}
        </Stack>
      )}

      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Button startIcon={<KeyboardArrowLeft />} disabled={step === 0 || loading} onClick={() => setStep(step - 1)}>Retour</Button>
        {step < 3
          ? <Button variant="contained" endIcon={<KeyboardArrowRight />} disabled={!canNext} onClick={() => setStep(step + 1)}>Continuer</Button>
          : <LoadingButton loading={loading} variant="contained" disabled={!canNext} onClick={() => void submit()}>Créer l'inscription</LoadingButton>}
      </Stack>
    </Paper>
  );
}
