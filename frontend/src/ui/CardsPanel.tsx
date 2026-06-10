import { CreditCardOff } from '@mui/icons-material';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, Card } from '../api';
import { useLanguage } from '../i18n';
import {
  CardLifecycleTimeline,
  CardTransitionDialog,
  DetailTabs,
  DigitalCardView,
  EmptySelection,
  EmptyState,
  FilterBar,
  SearchSelect,
  SelectOption,
  useToast,
} from './WorkflowComponents';
import { DataTable } from './DataTable';

export function CardsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  const language = useLanguage();
  const notify = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [student, setStudent] = useState<SelectOption | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [history, setHistory] = useState<Record<string, Array<Record<string, unknown>>> | null>(null);
  const [display, setDisplay] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [transition, setTransition] = useState('');

  async function load() {
    try {
      const [cardRows, studentRows] = await Promise.all([api.cards(), api.students('?page=1&page_size=100')]);
      setCards(cardRows);
      setStudents(studentRows.items.map((item) => ({
        id: item.id,
        label: `${item.first_name} ${item.last_name}`,
        subtitle: item.student_number,
        raw: item as unknown as Record<string, unknown>,
      })));
    } catch {
      onError(language === 'fr' ? 'Accès aux cartes refusé.' : 'Card access denied.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function selectCard(card: Card) {
    setSelected(card);
    const [nextHistory, nextDisplay] = await Promise.all([api.cardHistory(card.id), api.cardDisplay(card.id)]);
    setHistory(nextHistory);
    setDisplay(nextDisplay);
  }

  async function action(reasonCode: string, reason: string) {
    if (!selected) return;
    try {
      const card = await api.cardAction(selected.id, transition, reason, reasonCode);
      setSelected(card);
      const actionLabel = transition === 'revoke'
        ? (language === 'fr' ? 'révoquée' : 'revoked')
        : transition === 'suspend'
          ? (language === 'fr' ? 'suspendue' : 'suspended')
          : (language === 'fr' ? 'mise à jour' : 'updated');
      notify(language === 'fr' ? `Carte ${actionLabel}.` : `Card ${actionLabel}.`, 'success');
      await load();
      await selectCard(card);
    } catch {
      onError(language === 'fr' ? 'Opération sur la carte refusée.' : 'Card operation denied.');
    }
  }

  const filtered = cards.filter((card) => {
    const item = students.find((option) => option.id === card.student_id);
    const matchesText = `${item?.label ?? ''} ${item?.subtitle ?? ''} ${card.serial_number}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (!statusFilter || card.status === statusFilter);
  });
  const actions = selected?.status === 'REQUESTED' ? ['issue']
    : selected?.status === 'ISSUED' ? ['activate']
      : selected?.status === 'ACTIVE' ? ['suspend', 'revoke']
        : selected?.status === 'SUSPENDED' ? ['reactivate', 'revoke']
          : selected?.status === 'REVOKED' ? ['replace'] : [];

  return (
    <section className="cardsWorkspace">
      <Stack className="cardListPane" sx={{ gap: 2 }}>
        {(can('cards:request') || can('card:issue')) && (
          <Paper component="form" variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }} onSubmit={async (event) => {
            event.preventDefault();
            try {
              if (!student) return;
              await api.requestCard(student.id);
              notify(language === 'fr' ? 'Demande de carte créée.' : 'Card request created.', 'success');
              setStudent(null);
              await load();
            } catch {
              onError(language === 'fr' ? 'Émission de carte refusée.' : 'Card issuance denied.');
            }
          }}>
            <Typography variant="h6">{language === 'fr' ? 'Nouvelle demande' : 'New request'}</Typography>
            <SearchSelect label={language === 'fr' ? 'Rechercher un élève' : 'Search for a student'} options={students} value={student} onChange={setStudent} />
            <Button type="submit" variant="contained" startIcon={<CreditCard size={18} />}>{language === 'fr' ? 'Demander' : 'Request'}</Button>
          </Paper>
        )}
        <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }}>
          <input placeholder={language === 'fr' ? 'Nom, matricule ou numéro de série' : 'Name, student number or serial number'} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="statusFilters">
            {['', 'REQUESTED', 'ISSUED', 'ACTIVE', 'SUSPENDED', 'REVOKED'].map((status) => (
              <Button variant={statusFilter === status ? 'contained' : 'outlined'} size="small" key={status || 'ALL'} onClick={() => setStatusFilter(status)}>
                {status || (language === 'fr' ? 'Tous' : 'All')}
              </Button>
            ))}
          </div>
          <FilterBar
            filters={[...(query ? [{ key: 'query', label: `${language === 'fr' ? 'Recherche' : 'Search'} : ${query}` }] : []), ...(statusFilter ? [{ key: 'status', label: `${language === 'fr' ? 'Statut' : 'Status'} : ${statusFilter}` }] : [])]}
            onRemove={(key) => key === 'query' ? setQuery('') : setStatusFilter('')}
            onClear={() => { setQuery(''); setStatusFilter(''); }}
          />
          {cards.length === 0
            ? <EmptyState icon={<CreditCardOff />} title={language === 'fr' ? 'Aucune carte dans le périmètre' : 'No cards in scope'} description={language === 'fr' ? "Les cartes apparaissent ici après leur demande d'émission." : 'Cards appear here after an issuance request.'} />
            : <DataTable rows={filtered.map((card) => {
              const item = students.find((option) => option.id === card.student_id);
              return { id: card.id, eleve: item?.label, matricule: item?.subtitle, serie: card.serial_number, statut: card.status };
            })} onRow={(row) => {
              const card = cards.find((item) => item.id === row.id);
              if (card) void selectCard(card);
            }} />}
        </Paper>
      </Stack>
      <Paper variant="outlined" className="cardDetailPane" sx={{ p: 2 }}>
        {!selected || !display ? <EmptySelection label={language === 'fr' ? 'Sélectionnez une carte pour afficher son détail.' : 'Select a card to display its details.'} /> : (
          <Stack sx={{ gap: 2 }}>
            <DigitalCardView
              data={display}
              flipLabel={language === 'fr' ? 'Retourner' : 'Flip'}
              printLabel={language === 'fr' ? 'Imprimer' : 'Print'}
              backTitle={language === 'fr' ? "Conditions d'utilisation" : 'Terms of use'}
              backText1={language === 'fr' ? "Carte personnelle. Toute anomalie doit être signalée à l'établissement." : 'Personal card. Report any anomaly to the school.'}
              backText2={language === 'fr' ? 'Services activés : restauration, sport et prestations configurées.' : 'Enabled services: catering, sports and configured benefits.'}
            />
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {actions.map((name) => {
                const permission = name === 'revoke' ? can('card:revoke') : ['suspend', 'reactivate'].includes(name) ? can('card:suspend') : can('card:issue');
                return permission ? <Button variant="outlined" key={name} onClick={() => setTransition(name)}>{name}</Button> : null;
              })}
            </Stack>
            <DetailTabs
              technical={<DataTable rows={[display]} />}
              history={<CardLifecycleTimeline history={history} />}
              detailsLabel={language === 'fr' ? 'Détails' : 'Details'}
              historyLabel={language === 'fr' ? 'Historique' : 'History'}
              servicesLabel={language === 'fr' ? 'Services liés' : 'Related services'}
            />
          </Stack>
        )}
      </Paper>
      <CardTransitionDialog card={selected} action={transition} open={Boolean(transition)} onClose={() => setTransition('')} onConfirm={action} />
    </section>
  );
}
