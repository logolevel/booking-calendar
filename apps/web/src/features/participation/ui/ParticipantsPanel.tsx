import { useState } from 'react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  EVENT_TYPE,
  GENDER,
  PRIME_TIME_MAX_PER_WEEK,
  type EventDto,
  type Gender,
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
      return `${entry.targetName ?? entry.actorName} — з черги`;
    default:
      return entry.action;
  }
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
            {data.participants.map((p) => (
              <li key={p.id} className="participants__item">
                <span className="participants__name">
                  <PersonName
                    name={p.name}
                    gender={p.gender}
                    isAdmin={p.isAdmin}
                    isUser={p.userId != null}
                    isRoot={p.isRoot}
                  />
                  {p.isSelf && <span className="participants__you"> (ви)</span>}
                  {p.isGuest && (
                    <span className="participants__by"> · гість</span>
                  )}
                  {p.userId !== p.addedByUserId && (
                    <span className="participants__by">
                      {' '}
                      · {genderVerb(p.addedByGender, 'додав', 'додала')}{' '}
                      {p.addedByName}
                    </span>
                  )}
                </span>
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
              </li>
            ))}
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
                  {data.log.map((entry) => (
                    <li key={entry.id}>
                      <span>{logText(entry)}</span>
                      <span className="participants__by">
                        {format(new Date(entry.at), 'd MMM HH:mm', { locale: uk })}
                      </span>
                    </li>
                  ))}
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
