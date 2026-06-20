import { useState } from 'react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  EVENT_TYPE,
  GENDER,
  PRIME_TIME_MAX_PER_WEEK,
  type EventDto,
  type Gender,
  type ParticipantDto,
  type ParticipationLogDto,
} from '@tg-calendar/shared-types';
import { eventTypeLabel, resourceLabel } from '../../calendar/eventLabels';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { PersonName } from '../../../shared/ui/PersonName';
import {
  useEventParticipants,
  useParticipationActions,
  useUserSearch,
} from '../useParticipation';
import { useEventRealtime } from '../useEventRealtime';
import { useDeleteEvent } from '../../calendar/useEvents';
import { AddGuest } from './AddGuest';

const RESOURCE_COLOR: Record<number, string> = {
  1: 'var(--resource-1)',
  2: 'var(--resource-2)',
};

// Choose the verb form by gender; fall back to masculine when unknown.
function genderVerb(
  gender: Gender | null,
  male: string,
  female: string,
): string {
  return gender === GENDER.FEMALE ? female : male;
}

function logText(entry: ParticipationLogDto): string {
  const g = entry.actorGender;
  switch (entry.action) {
    case 'join':
      return `${entry.actorName} ${genderVerb(g, 'записався', 'записалася')}`;
    case 'add':
      return `${entry.actorName} ${genderVerb(g, 'додав', 'додала')} ${
        entry.targetName ?? ''
      }`.trim();
    case 'leave':
      return `${entry.actorName} ${genderVerb(g, 'вийшов', 'вийшла')}`;
    case 'remove':
      return `${entry.actorName} ${genderVerb(g, 'видалив', 'видалила')} ${
        entry.targetName ?? ''
      }`.trim();
    case 'promoted':
      return `${entry.targetName ?? entry.actorName} — з черги в учасники`;
    case 'queued':
      return `${entry.actorName} ${genderVerb(g, 'став', 'стала')} у чергу`;
    case 'left_queue':
      return `${entry.actorName} ${genderVerb(g, 'вийшов', 'вийшла')} з черги`;
    case 'paired':
      return `${entry.actorName} ${genderVerb(g, 'створив', 'створила')} пару${
        entry.targetName ? ` з ${entry.targetName}` : ''
      } 🔗`;
    case 'unpaired':
      return `${entry.actorName} ${genderVerb(
        g,
        'розформував',
        'розформувала',
      )} пару${entry.targetName ? ` з ${entry.targetName}` : ''} 🔗`;
    case 'edited':
      return `${entry.actorName} ${genderVerb(g, 'змінив', 'змінила')} подію${
        entry.targetName ? `: ${entry.targetName}` : ''
      }`;
    default:
      return entry.action;
  }
}

// History tone: entering the event (join/add/promoted) reads as positive
// (light green); leaving the event (leave/remove) as negative (light red).
// Queue/pair/edit actions are neutral (no background).
function logTone(action: ParticipationLogDto['action']): 'enter' | 'exit' | null {
  if (action === 'join' || action === 'add' || action === 'promoted') {
    return 'enter';
  }
  if (action === 'leave' || action === 'remove') {
    return 'exit';
  }
  return null;
}

// A pair group renders its two members together; singles render on their own.
type ParticipantGroup =
  | { kind: 'single'; p: ParticipantDto }
  | { kind: 'pair'; members: [ParticipantDto, ParticipantDto] };

// Keep join order, but render a pair's two members together as one group.
function groupParticipants(list: ParticipantDto[]): ParticipantGroup[] {
  const groups: ParticipantGroup[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    if (seen.has(p.id)) {
      continue;
    }
    const partner =
      p.pairId != null
        ? list.find((o) => o.id !== p.id && o.pairId === p.pairId)
        : undefined;
    if (partner) {
      groups.push({ kind: 'pair', members: [p, partner] });
      seen.add(p.id);
      seen.add(partner.id);
    } else {
      groups.push({ kind: 'single', p });
      seen.add(p.id);
    }
  }
  return groups;
}

interface Props {
  event: EventDto;
  onEdit: () => void;
  onClose: () => void;
}

export function ParticipantsPanel({
  event,
  onEdit,
  onClose,
}: Props): JSX.Element {
  useEventRealtime(event.id);
  const { data, isLoading } = useEventParticipants(event.id);
  const actions = useParticipationActions(event.id);
  const deleteEvent = useDeleteEvent();

  // A pending confirmation: its message and the action to run on "Так".
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // The event vanishes when its last member leaves; close the sheet then.
  const closeIfDeleted = (res: { deleted?: boolean }): void => {
    if (res.deleted) {
      onClose();
    }
  };

  const askLeave = (): void => {
    setConfirm({
      message: 'Ви дійсно хочете вийти з події?',
      onConfirm: () =>
        actions.leave.mutate(undefined, { onSuccess: closeIfDeleted }),
    });
  };

  const askRemove = (participantId: string, name: string, isSelf: boolean): void => {
    setConfirm({
      message: isSelf
        ? 'Ви дійсно хочете вийти з події?'
        : `Ви дійсно хочете прибрати ${name} з події?`,
      onConfirm: () =>
        actions.remove.mutate(participantId, { onSuccess: closeIfDeleted }),
    });
  };

  const askUnqueue = (): void => {
    setConfirm({
      message: 'Ви дійсно хочете вийти з черги?',
      onConfirm: () => actions.unqueue.mutate(),
    });
  };

  const askUnpair = (): void => {
    setConfirm({
      message: 'Прибрати учасника зі своєї пари?',
      onConfirm: () => actions.unpair.mutate(),
    });
  };

  const askDelete = (): void => {
    setConfirm({
      message: 'Ви дійсно хочете видалити подію? Цю дію не можна скасувати.',
      onConfirm: () => deleteEvent.mutate(event.id, { onSuccess: onClose }),
    });
  };

  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const search = useUserSearch(query);

  const isGroup = event.type === EVENT_TYPE.GROUP;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  // A finished event is read-only: only viewing, no joins/edits/deletes.
  const ended = end.getTime() <= Date.now();
  const title = event.title ?? eventTypeLabel(event.type);

  const renderSelfAction = (): JSX.Element | null => {
    if (!data) {
      return null;
    }
    if (data.isParticipant) {
      return (
        <Button
          variant="secondary"
          block
          disabled={actions.isPending}
          onClick={askLeave}
        >
          Вийти
        </Button>
      );
    }
    if (data.isWaitlisted) {
      return (
        <Button
          variant="secondary"
          block
          disabled={actions.isPending}
          onClick={askUnqueue}
        >
          Вийти з черги
        </Button>
      );
    }
    if (data.isFull) {
      return (
        <Button
          block
          disabled={actions.isPending}
          onClick={() => actions.queue.mutate()}
        >
          Стати в чергу
        </Button>
      );
    }
    return (
      <Button
        block
        disabled={actions.isPending}
        onClick={() => actions.join.mutate()}
      >
        Записатися
      </Button>
    );
  };

  const existingIds = new Set(
    (data?.participants ?? [])
      .map((p) => p.userId)
      .filter((id): id is number => id != null),
  );
  const existingGuestIds = new Set(
    (data?.participants ?? [])
      .map((p) => p.guestId)
      .filter((id): id is string => id != null),
  );
  const searchResults = (search.data ?? []).filter(
    (u) => !existingIds.has(u.id),
  );

  const selfParticipant = data?.participants.find((p) => p.isSelf) ?? null;
  const selfPairId = selfParticipant?.pairId ?? null;
  const pairGroups = groupParticipants(data?.participants ?? []);

  // Which 🔗 control (if any) to show next to a participant for this viewer:
  // unpaired viewers may pair with any free participant; a paired viewer only
  // sees the unpair control next to their own partner.
  const pairModeFor = (p: ParticipantDto): 'pair' | 'unpair' | null => {
    if (ended || !selfParticipant || p.isSelf) {
      return null;
    }
    if (selfPairId) {
      return p.pairId === selfPairId ? 'unpair' : null;
    }
    return p.pairId ? null : 'pair';
  };

  const renderMember = (p: ParticipantDto): JSX.Element => {
    const pairMode = pairModeFor(p);
    return (
      <>
        <span className="participants__name">
          <PersonName
            name={p.name}
            gender={p.gender}
            isAdmin={p.isAdmin}
            isUser={p.userId != null}
            isRoot={p.isRoot}
          />
          {p.isSelf && <span className="participants__you"> (ви)</span>}
          {p.isGuest && <span className="participants__by"> · гість</span>}
          {p.userId !== p.addedByUserId && (
            <span className="participants__by">
              {' '}
              · {genderVerb(p.addedByGender, 'додав', 'додала')} {p.addedByName}
            </span>
          )}
        </span>
        {pairMode === 'pair' && (
          <button
            type="button"
            className="participants__pair-btn"
            aria-label="Об'єднати в пару"
            disabled={actions.isPending}
            onClick={() => actions.pair.mutate(p.id)}
          >
            🔗
          </button>
        )}
        {pairMode === 'unpair' && (
          <button
            type="button"
            className="participants__pair-btn participants__pair-btn--active"
            aria-label="Прибрати з пари"
            disabled={actions.isPending}
            onClick={askUnpair}
          >
            🔗
          </button>
        )}
        {p.primeWeekCount != null && (
          <span
            className={`participants__quota${
              p.primeWeekCount >= PRIME_TIME_MAX_PER_WEEK
                ? ' participants__quota--full'
                : ''
            }`}
            title="Записи у прайм-тайм цього тижня"
          >
            {p.primeWeekCount}/{PRIME_TIME_MAX_PER_WEEK}
          </span>
        )}
        {p.canRemove && !ended && (
          <button
            type="button"
            className="participants__remove"
            aria-label="Прибрати"
            disabled={actions.isPending}
            onClick={() => askRemove(p.id, p.name, p.isSelf)}
          >
            ✕
          </button>
        )}
      </>
    );
  };

  return (
    <div className="participants">
      <div className="participants__head">
        <span
          className="participants__dot"
          style={{ background: RESOURCE_COLOR[event.resourceId] ?? 'var(--accent)' }}
        />
        <div>
          <div className="participants__title">{title}</div>
          <div className="participants__time">
            Майданчик {resourceLabel(event.resourceId)} ·{' '}
            {format(start, 'd MMM, HH:mm', { locale: uk })} –{' '}
            {format(end, 'HH:mm', { locale: uk })}
          </div>
        </div>
      </div>

      {ended && (
        <p className="participants__readonly">Подію завершено · лише перегляд</p>
      )}

      {isGroup && (
        <div className="participants__organizer">
          <div className="participants__subtitle">Організатор</div>
          <div className="participants__organizer-name">
            {event.organizerName ?? '—'}
          </div>
          {event.groupSize != null && (
            <div className="participants__time">
              Кількість людей: {event.groupSize}
            </div>
          )}
          {event.organizerPhone && (
            <a
              className="participants__phone"
              href={`tel:${event.organizerPhone}`}
            >
              📞 {event.organizerPhone}
            </a>
          )}
        </div>
      )}

      {!isGroup && (
        <div className="participants__count">
          Учасники {data ? `${data.count}/${data.capacity}` : '…'}
        </div>
      )}

      {!isGroup && isLoading && (
        <p className="state__text">Завантаження…</p>
      )}

      {!isGroup && data && (
        <>
          <ul className="participants__list">
            {pairGroups.map((g) =>
              g.kind === 'pair' ? (
                <li key={g.members[0].id} className="participants__pair">
                  <div className="participants__pair-tag">🔗 Команда</div>
                  {g.members.map((m) => (
                    <div key={m.id} className="participants__pair-row">
                      {renderMember(m)}
                    </div>
                  ))}
                </li>
              ) : (
                <li key={g.p.id} className="participants__item">
                  {renderMember(g.p)}
                </li>
              ),
            )}
            {data.participants.length === 0 && (
              <li className="participants__empty">Ще ніхто не записався</li>
            )}
          </ul>

          {!ended && actions.error && (
            <p className="form__error">{actions.error.message}</p>
          )}

          {!ended && renderSelfAction()}

          {!ended && (data.isAdmin || data.isParticipant) && (
            <div className="participants__add">
              <input
                className="participants__search"
                placeholder="Додати учасника (ім'я або @username)"
                value={query}
                disabled={!data.canAddPlusOne}
                onChange={(e) => setQuery(e.target.value)}
              />
              {data.canAddPlusOne && query.trim().length >= 2 && (
                <ul className="participants__results">
                  {searchResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="participants__result"
                        disabled={actions.isPending}
                        onClick={() => {
                          actions.add.mutate(u.id);
                          setQuery('');
                        }}
                      >
                        {u.name}
                        {u.username && (
                          <span className="participants__by"> @{u.username}</span>
                        )}
                      </button>
                    </li>
                  ))}
                  {!search.isLoading && searchResults.length === 0 && (
                    <li className="participants__empty">Нічого не знайдено</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {!ended && (data.isAdmin || data.isParticipant) && (
            <AddGuest
              actions={actions}
              existingGuestIds={existingGuestIds}
              disabled={!data.canAddPlusOne}
            />
          )}

          {!ended && data.isParticipant && (
            <label className="participants__checkbox participants__reminder">
              <input
                type="checkbox"
                checked={data.remindBeforeEvent}
                disabled={actions.reminder.isPending}
                onChange={(e) => actions.reminder.mutate(e.target.checked)}
              />
              Нагадати мені за 1 годину до події
            </label>
          )}

          {data.waitlist.length > 0 && (
            <div className="participants__section">
              <div className="participants__subtitle">Черга</div>
              <ul className="participants__list">
                {data.waitlist.map((w, i) => (
                  <li key={w.userId} className="participants__item">
                    <span className="participants__name">
                      {i + 1}.{' '}
                      <PersonName
                        name={w.name}
                        gender={w.gender}
                        isAdmin={w.isAdmin}
                        isUser
                        isRoot={w.isRoot}
                      />
                      {w.isSelf && <span className="participants__you"> (ви)</span>}
                    </span>
                    {w.isSelf && !ended && (
                      <button
                        type="button"
                        className="participants__remove"
                        aria-label="Вийти з черги"
                        disabled={actions.isPending}
                        onClick={askUnqueue}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.log.length > 0 && (
            <div className="participants__section">
              <button
                type="button"
                className="participants__history-toggle"
                onClick={() => setShowHistory((v) => !v)}
              >
                Історія {showHistory ? '▴' : '▾'}
              </button>
              {showHistory && (
                <ul className="participants__history">
                  {data.log.map((entry) => {
                    const tone = logTone(entry.action);
                    return (
                      <li
                        key={entry.id}
                        className={
                          tone
                            ? `participants__history-item--${tone}`
                            : undefined
                        }
                      >
                        <span>{logText(entry)}</span>
                        <span className="participants__by">
                          {format(new Date(entry.at), 'd MMM HH:mm', {
                            locale: uk,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {!ended && data && (data.isAdmin || data.isAuthor) && (
        <div className="participants__edit">
          <Button variant="ghost" block onClick={onEdit}>
            Редагувати подію
          </Button>
          <Button
            variant="ghost"
            block
            className="btn--danger"
            disabled={deleteEvent.isPending}
            onClick={askDelete}
          >
            Видалити подію
          </Button>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => {
            confirm.onConfirm();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
