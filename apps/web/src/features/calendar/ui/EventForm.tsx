import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import {
  DEFAULT_CAPACITY,
  EVENT_TYPE,
  GREEN_RESOURCE_ID,
  MAX_CAPACITY,
  MIN_CAPACITY,
  PRIME_TIME_MAX_GREEN_PER_WEEK,
  PRIME_TIME_MAX_PER_WEEK,
  RESOURCE_IDS,
  type EventDto,
  type EventType,
  type ResourceId,
} from '@tg-calendar/shared-types';
import { useCreateEvent, usePrimeQuota, useUpdateEvent } from '../useEvents';
import { memberGateOpen, overlapsPrime, parseHhMm } from '../model/slotTime';
import { eventTypeLabel, resourceLabel } from '../eventLabels';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';

const CAPACITY_OPTIONS = Array.from(
  { length: MAX_CAPACITY - MIN_CAPACITY + 1 },
  (_, i) => MIN_CAPACITY + i,
);

// Typical training length; the end time is suggested as start + this.
const DEFAULT_DURATION_HOURS = 2;
const LOCAL_PATTERN = "yyyy-MM-dd'T'HH:mm";

// Current time rounded down to the start of the hour (:00).
function currentHour(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return format(d, LOCAL_PATTERN);
}

function toLocalInput(iso: string): string {
  return format(new Date(iso), LOCAL_PATTERN);
}

function addHours(value: string, hours: number): string {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  d.setHours(d.getHours() + hours);
  return format(d, LOCAL_PATTERN);
}

interface Props {
  event?: EventDto;
  isAdmin: boolean;
  isTrainer?: boolean;
  // Display name ("Прізвище Ім'я") of the current user; used for the
  // "Я тренер" auto-fill of the organizer field.
  currentUserName?: string;
  // ISO strings used to prefill a new event created from a calendar slot.
  initialStart?: string;
  initialEnd?: string;
  // Subscription-prime window ("HH:MM") gated for regular members, plus the
  // gate-open hour and whether the viewer holds an active subscription.
  subPrimeStart?: string;
  subPrimeEnd?: string;
  primeMemberOpenHour?: number;
  isSubscriber?: boolean;
  onClose: () => void;
}

export function EventForm({
  event,
  isAdmin,
  isTrainer = false,
  currentUserName = '',
  initialStart,
  initialEnd,
  subPrimeStart,
  subPrimeEnd,
  primeMemberOpenHour,
  isSubscriber,
  onClose,
}: Props): JSX.Element {
  const isEdit = Boolean(event);
  const [type, setType] = useState<EventType>(event?.type ?? EVENT_TYPE.MIXED);
  const [resourceId, setResourceId] = useState<ResourceId>(
    event?.resourceId ?? RESOURCE_IDS[0],
  );
  const [capacity, setCapacity] = useState<number>(
    event?.capacity ?? DEFAULT_CAPACITY,
  );
  const [organizerName, setOrganizerName] = useState<string>(
    event?.organizerName ?? '',
  );
  const [organizerPhone, setOrganizerPhone] = useState<string>(
    event?.organizerPhone ?? '',
  );
  const [groupSize, setGroupSize] = useState<string>(
    event?.groupSize != null ? String(event.groupSize) : '',
  );
  // Admin only: create an event without joining it (empty event for others).
  const [skipSelf, setSkipSelf] = useState<boolean>(false);
  // Trainer convenience: auto-fill organizer name from the current user.
  const [iAmTrainer, setIAmTrainer] = useState<boolean>(false);

  const isGroup = type === EVENT_TYPE.GROUP;
  // A non-admin author may edit only the capacity; everything else is locked.
  const limitOnly = isEdit && !isAdmin;
  // An author may only raise the limit, never below who is already in.
  const minCapacity = limitOnly
    ? Math.max(MIN_CAPACITY, event?.participantCount ?? MIN_CAPACITY)
    : MIN_CAPACITY;
  const capacityOptions = CAPACITY_OPTIONS.filter((n) => n >= minCapacity);
  // GROUP type is available to admins and trainers; keep it when editing one.
  const typeOptions = Object.values(EVENT_TYPE).filter(
    (t) =>
      t !== EVENT_TYPE.GROUP ||
      isAdmin ||
      isTrainer ||
      event?.type === EVENT_TYPE.GROUP,
  );
  const [startsAt, setStartsAt] = useState<string>(
    event
      ? toLocalInput(event.startsAt)
      : initialStart
        ? toLocalInput(initialStart)
        : currentHour(),
  );
  const [endsAt, setEndsAt] = useState<string>(
    event
      ? toLocalInput(event.endsAt)
      : initialEnd
        ? toLocalInput(initialEnd)
        : '',
  );
  // The end field stays disabled until the user actively sets the start.
  // A slot-prefilled draft already has both times, so treat it as touched.
  const [startTouched, setStartTouched] = useState<boolean>(
    isEdit || Boolean(initialStart),
  );

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const mutation = isEdit ? updateEvent : createEvent;

  // Drop a stale submit error as soon as the user changes anything.
  const clearError = (): void => {
    if (mutation.isError) {
      mutation.reset();
    }
  };

  const onStartChange = (value: string): void => {
    clearError();
    setStartsAt(value);
    setStartTouched(true);
    // Each start change re-suggests start + 2h; the user may then adjust it.
    setEndsAt(addHours(value, DEFAULT_DURATION_HOURS));
  };

  // On Android, confirming the prefilled start fires no change/blur event.
  // Focusing the start (tapping to open the picker) is the reliable signal:
  // enable the end and fill it from the current start when still empty.
  const onStartFocus = (): void => {
    if (startsAt && !endsAt) {
      setStartTouched(true);
      setEndsAt(addHours(startsAt, DEFAULT_DURATION_HOURS));
    }
  };

  const onEndChange = (value: string): void => {
    clearError();
    setEndsAt(value);
  };

  // A regular member without a subscription may not create an event in the
  // subscription-prime window until the access gate opens; block before submit
  // so they don't fill in a form the backend would reject. Admins and active
  // subscribers are never gated here.
  const subStartMin = subPrimeStart ? parseHhMm(subPrimeStart) : null;
  const subEndMin = subPrimeEnd ? parseHhMm(subPrimeEnd) : null;
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  const primeBlocked =
    !isAdmin &&
    !isEdit &&
    !isSubscriber &&
    primeMemberOpenHour != null &&
    subStartMin != null &&
    subEndMin != null &&
    subStartMin < subEndMin &&
    start != null &&
    end != null &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    overlapsPrime(start, end, subStartMin, subEndMin) &&
    !memberGateOpen(start, primeMemberOpenHour);

  // The weekly prime-time quota applies to the creator's auto-join, i.e. only
  // for a brand-new event the creator actually joins. Preview it so the user
  // sees their "N/2" status and learns up front why a slot may be unavailable.
  const validStart = start != null && !Number.isNaN(start.getTime());
  const validEnd = end != null && !Number.isNaN(end.getTime());
  const quotaRelevant = !isEdit && !isGroup && !(isAdmin && skipSelf);
  const startIso = validStart ? start.toISOString() : null;
  const endIso = validEnd ? end.toISOString() : null;
  const { data: quota } = usePrimeQuota(
    startIso,
    endIso,
    resourceId,
    quotaRelevant,
  );
  const quotaInPrime = quotaRelevant && (quota?.inPrime ?? false);
  const atPrimeLimit =
    quotaInPrime && (quota?.weekCount ?? 0) >= PRIME_TIME_MAX_PER_WEEK;
  const atGreenLimit =
    quotaInPrime &&
    resourceId === GREEN_RESOURCE_ID &&
    (quota?.greenWeekCount ?? 0) >= PRIME_TIME_MAX_GREEN_PER_WEEK;
  const quotaBlocked = atPrimeLimit || atGreenLimit;

  // The backend returns informative, localized reasons (overlap, date limit,
  // prime-time gate/quota). Surface them directly for the expected 4xx codes;
  // fall back to a generic line for anything else (e.g. network/5xx).
  const serverError =
    mutation.error instanceof ApiError &&
    [400, 403, 409].includes(mutation.error.status) &&
    mutation.error.message
      ? mutation.error.message
      : null;

  const errorMessage = primeBlocked
    ? 'Цей час у прайм-абонемент вікні поки недоступний. Він відкриється напередодні події (або одразу — з абонементом).'
    : atPrimeLimit
      ? `У прайм-тайм можна записатися не більше ${PRIME_TIME_MAX_PER_WEEK} разів на тиждень. Цього тижня ліміт вичерпано.`
      : atGreenLimit
        ? 'На зелений майданчик у прайм-тайм можна записатися лише раз на тиждень. Оберіть червоний майданчик.'
        : mutation.isError
          ? serverError ?? 'Не вдалося зберегти подію. Спробуйте ще раз.'
          : null;

  const effectiveOrganizerName = iAmTrainer ? currentUserName : organizerName;

  // Same pattern as the backend DTO: Ukrainian mobile/landline numbers.
  const UA_PHONE_RE =
    /^\+?3?8?0[\s-]?(\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\(?\d{3}\)?[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})$/;
  const phoneRaw = organizerPhone.trim();
  const phoneInvalid = phoneRaw.length > 0 && !UA_PHONE_RE.test(phoneRaw);

  const canSubmit =
    Boolean(startsAt) &&
    Boolean(endsAt) &&
    !primeBlocked &&
    !quotaBlocked &&
    (!isGroup || effectiveOrganizerName.trim().length > 0) &&
    (!isGroup || groupSize.trim().length > 0) &&
    (!isGroup || !phoneInvalid);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    const body = {
      type,
      resourceId,
      // Group bookings have no sign-up list; capacity is irrelevant.
      capacity: isGroup ? MIN_CAPACITY : capacity,
      title: event?.title ?? undefined,
      organizerName: isGroup ? effectiveOrganizerName.trim() : undefined,
      organizerPhone:
        isGroup && organizerPhone.trim() ? organizerPhone.trim() : undefined,
      groupSize:
        isGroup && groupSize.trim() ? Number(groupSize) : undefined,
      skipSelf: isAdmin && !isGroup && !isEdit ? skipSelf : undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };
    if (event) {
      updateEvent.mutate({ id: event.id, body }, { onSuccess: onClose });
    } else {
      createEvent.mutate(body, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="field__label">Тип</span>
        <select
          value={type}
          disabled={limitOnly}
          onChange={(e) => {
            clearError();
            setType(e.target.value as EventType);
          }}
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {eventTypeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Майданчик</span>
        <select
          value={resourceId}
          disabled={limitOnly}
          onChange={(e) => {
            clearError();
            setResourceId(Number(e.target.value) as ResourceId);
          }}
        >
          {RESOURCE_IDS.map((id) => (
            <option key={id} value={id}>
              {resourceLabel(id)}
            </option>
          ))}
        </select>
      </label>

      {isGroup ? (
        <>
          <label className="field">
            <span className="field__label">Ім'я організатора групи/тренера</span>
            <input
              type="text"
              value={iAmTrainer ? currentUserName : organizerName}
              disabled={iAmTrainer}
              onChange={(e) => {
                clearError();
                setOrganizerName(e.target.value);
              }}
            />
          </label>

          <label className="participants__checkbox field">
            <input
              type="checkbox"
              checked={iAmTrainer}
              onChange={(e) => {
                setIAmTrainer(e.target.checked);
                clearError();
              }}
            />
            Я тренер
          </label>

          <label className="field">
            <span className="field__label">Номер телефону (необов'язково)</span>
            <input
              type="tel"
              inputMode="tel"
              value={organizerPhone}
              placeholder="+380 XX XXX XX XX"
              className={phoneInvalid ? 'input--error' : undefined}
              onChange={(e) => {
                clearError();
                setOrganizerPhone(e.target.value);
              }}
            />
            {phoneInvalid && (
              <span className="field__error">
                Введіть коректний номер (+380...)
              </span>
            )}
          </label>

          <label className="field">
            <span className="field__label">Кількість людей</span>
            <input
              type="text"
              inputMode="numeric"
              value={groupSize}
              onChange={(e) => {
                clearError();
                setGroupSize(e.target.value.replace(/\D/g, '').slice(0, 3));
              }}
            />
          </label>
        </>
      ) : (
        <label className="field">
          <span className="field__label">Ліміт учасників</span>
          <select
            value={capacity}
            onChange={(e) => {
              clearError();
              setCapacity(Number(e.target.value));
            }}
          >
            {capacityOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="field__label">Початок</span>
        <input
          type="datetime-local"
          value={startsAt}
          disabled={limitOnly}
          onChange={(e) => onStartChange(e.target.value)}
          onFocus={onStartFocus}
        />
      </label>

      <label className="field">
        <span className="field__label">Кінець</span>
        <input
          type="datetime-local"
          value={endsAt}
          disabled={limitOnly || !startTouched}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </label>

      {quotaInPrime && (
        <div className="form__prime">
          <span
            className={`participants__quota${
              atPrimeLimit ? ' participants__quota--full' : ''
            }`}
          >
            {quota?.weekCount ?? 0}/{PRIME_TIME_MAX_PER_WEEK}
          </span>
          <span className="form__prime-text">
            ваші записи у прайм-тайм цього тижня
          </span>
        </div>
      )}

      {isAdmin && !isGroup && !isEdit && (
        <label className="participants__checkbox field">
          <input
            type="checkbox"
            checked={skipSelf}
            onChange={(e) => setSkipSelf(e.target.checked)}
          />
          Не записувати мене
        </label>
      )}

      {errorMessage && <p className="form__error">{errorMessage}</p>}

      <div className="form__actions">
        <Button variant="secondary" block onClick={onClose}>
          Скасувати
        </Button>
        <Button type="submit" block disabled={mutation.isPending || !canSubmit}>
          Зберегти
        </Button>
      </div>
    </form>
  );
}
