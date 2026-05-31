import { useState } from 'react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  EVENT_TYPE,
  type EventDto,
  type ParticipationLogDto,
} from '@tg-calendar/shared-types';
import { eventTypeLabel } from '../../calendar/eventLabels';
import { Button } from '../../../shared/ui/Button';
import { PersonName } from '../../../shared/ui/PersonName';
import {
  useEventParticipants,
  useParticipationActions,
  useUserSearch,
} from '../useParticipation';
import { useEventRealtime } from '../useEventRealtime';
import { AddGuest } from './AddGuest';

const RESOURCE_COLOR: Record<number, string> = {
  1: 'var(--resource-1)',
  2: 'var(--resource-2)',
};

function logText(entry: ParticipationLogDto): string {
  switch (entry.action) {
    case 'join':
      return `${entry.actorName} записався`;
    case 'add':
      return `${entry.actorName} додав(ла) ${entry.targetName ?? ''}`.trim();
    case 'leave':
      return `${entry.actorName} вийшов`;
    case 'remove':
      return `${entry.actorName} видалив(ла) ${entry.targetName ?? ''}`.trim();
    case 'promoted':
      return `${entry.targetName ?? entry.actorName} — з черги`;
    default:
      return entry.action;
  }
}

interface Props {
  event: EventDto;
  onEdit: () => void;
}

export function ParticipantsPanel({ event, onEdit }: Props): JSX.Element {
  useEventRealtime(event.id);
  const { data, isLoading } = useEventParticipants(event.id);
  const actions = useParticipationActions(event.id);
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const search = useUserSearch(query);

  const isGroup = event.type === EVENT_TYPE.GROUP;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
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
          onClick={() => actions.leave.mutate()}
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
          onClick={() => actions.unqueue.mutate()}
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
            Площадка №{event.resourceId} ·{' '}
            {format(start, 'd MMM, HH:mm', { locale: uk })} –{' '}
            {format(end, 'HH:mm', { locale: uk })}
          </div>
        </div>
      </div>

      {isGroup && (
        <div className="participants__organizer">
          <div className="participants__subtitle">Організатор</div>
          <div className="participants__organizer-name">
            {event.organizerName ?? '—'}
          </div>
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
                  />
                  {p.isSelf && <span className="participants__you"> (ви)</span>}
                  {p.isGuest && (
                    <span className="participants__by"> · гість</span>
                  )}
                  {p.userId !== p.addedByUserId && (
                    <span className="participants__by">
                      {' '}
                      · додав(ла) {p.addedByName}
                    </span>
                  )}
                </span>
                {p.canRemove && (
                  <button
                    type="button"
                    className="participants__remove"
                    aria-label="Прибрати"
                    disabled={actions.isPending}
                    onClick={() => actions.remove.mutate(p.id)}
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

          {renderSelfAction()}

          {(data.isAdmin || data.isParticipant) && (
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

          {(data.isAdmin || data.isParticipant) && (
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
                      />
                      {w.isSelf && <span className="participants__you"> (ви)</span>}
                    </span>
                    {w.isSelf && (
                      <button
                        type="button"
                        className="participants__remove"
                        aria-label="Вийти з черги"
                        disabled={actions.isPending}
                        onClick={() => actions.unqueue.mutate()}
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

      <div className="participants__edit">
        <Button variant="ghost" block onClick={onEdit}>
          Редагувати подію
        </Button>
      </div>
    </div>
  );
}
