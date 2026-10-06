import { useHelp } from '../api';
import { back } from '../router';
import { hasNativeBack } from '../tg';
import { Icon, Notice, RowsPlaceholder } from '../ui';

/**
 * Справка — тот же текст, что бот показывает по /help: он приходит
 * с сервиса, а не лежит здесь второй копией. Числа в нём (рабочие часы,
 * срок реакции) — из настроек, поэтому справка не устаревает.
 */
export function HelpScreen() {
  const help = useHelp();
  return (
    <main className="screen">
      {!hasNativeBack() && (
        <button type="button" className="backlink" onClick={back}>
          <Icon name="back" size={18} />
          Сегодня
        </button>
      )}
      <header className="top">
        <h1 className="top__title">Справка</h1>
      </header>

      {help.isPending ? (
        <RowsPlaceholder />
      ) : help.isError ? (
        <Notice title="Не удалось загрузить справку" text="Нет связи с сервисом бота." action={{ label: 'Повторить', onClick: () => void help.refetch() }} />
      ) : (
        help.data.map((s) => (
          <section key={s.id} aria-label={s.title}>
            <h2 className="group">{s.title}</h2>
            <p className="lede">{s.intro}</p>
            <dl className="terms">
              {s.items.map((i) => (
                <div key={i.term}>
                  <dt>{i.term}</dt>
                  <dd>{i.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </main>
  );
}
