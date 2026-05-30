// Telegram injects `--tg-theme-*` CSS vars and updates them on theme change.
// We only sync native header/background and expose colorScheme via data-theme.
export function initTelegram(): void {
  const wa = window.Telegram?.WebApp;

  if (!wa) {
    document.documentElement.dataset.theme = 'light';
    return;
  }

  wa.ready();
  wa.expand();

  const apply = (): void => {
    document.documentElement.dataset.theme = wa.colorScheme;
    try {
      wa.setHeaderColor('bg_color');
      wa.setBackgroundColor('bg_color');
    } catch {
      // older clients may not support these calls
    }
  };

  apply();
  wa.onEvent('themeChanged', apply);
}
