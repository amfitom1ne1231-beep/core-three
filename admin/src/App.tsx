import { useEffect } from 'react';
import { ApiError, useMe } from './api';
import { back, navigate, useRoute } from './router';
import { LeadScreen } from './screens/Lead';
import { Leads } from './screens/Leads';
import { NewLead } from './screens/NewLead';
import { inTelegram, nativeBack, startLeadId } from './tg';
import { MeContext, Notice, RowsPlaceholder } from './ui';

// приложение открыли по прямой ссылке на заявку — один раз переходим на неё
let startHandled = false;

export function App() {
  const me = useMe();
  const route = useRoute();
  const inner = route.name !== 'leads';

  useEffect(() => {
    const off = nativeBack(inner, back);
    return () => off?.();
  }, [inner]);

  useEffect(() => {
    if (startHandled) return;
    startHandled = true;
    const id = startLeadId();
    if (id && route.name === 'leads') navigate({ name: 'lead', id }, { replace: true });
  }, [route.name]);

  if (me.isPending) {
    return (
      <main className="screen">
        <RowsPlaceholder />
      </main>
    );
  }

  if (me.isError) {
    const status = me.error instanceof ApiError ? me.error.status : 0;
    return (
      <main className="screen">
        {status === 403 ? (
          <Notice title="Доступ только у команды" text="Это рабочий инструмент студии CoreThree. Если вы из команды — попросите приглашение у владельца." />
        ) : status === 401 ? (
          <Notice
            title={inTelegram ? 'Вход устарел' : 'Откройте приложение в Telegram'}
            text={inTelegram ? 'Закройте приложение и откройте его заново из бота.' : 'Вход — по Telegram: кнопка «Студия» в чате с ботом студии.'}
          />
        ) : (
          <Notice title="Нет связи с сервисом" text="Сервис бота не отвечает." action={{ label: 'Повторить', onClick: () => void me.refetch() }} />
        )}
      </main>
    );
  }

  return (
    <MeContext.Provider value={me.data}>
      {route.name === 'lead' ? <LeadScreen key={route.id} id={route.id} /> : route.name === 'new' ? <NewLead /> : <Leads />}
    </MeContext.Provider>
  );
}
