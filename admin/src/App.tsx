import { useEffect } from 'react';
import { ApiError, useMe } from './api';
import { back, isRoot, navigate, useRoute, type Route } from './router';
import { LeadScreen } from './screens/Lead';
import { Leads } from './screens/Leads';
import { NewLead } from './screens/NewLead';
import { NewProject } from './screens/NewProject';
import { ProjectScreen } from './screens/Project';
import { Projects } from './screens/Projects';
import { inTelegram, nativeBack, startTarget } from './tg';
import { MeContext, Notice, RowsPlaceholder, TabBar } from './ui';

// приложение открыли по прямой ссылке на заявку или проект — один раз переходим туда
let startHandled = false;

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'lead':
      return <LeadScreen key={route.id} id={route.id} />;
    case 'new':
      return <NewLead />;
    case 'projects':
      return <Projects />;
    case 'project':
      return <ProjectScreen key={route.id} id={route.id} />;
    case 'project-new':
      return <NewProject />;
    default:
      return <Leads />;
  }
}

export function App() {
  const me = useMe();
  const route = useRoute();
  const inner = !isRoot(route);

  useEffect(() => {
    const off = nativeBack(inner, back);
    return () => off?.();
  }, [inner]);

  useEffect(() => {
    if (startHandled) return;
    startHandled = true;
    const target = startTarget();
    if (target && route.name === 'leads') navigate(target, { replace: true });
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
      <Screen route={route} />
      {!inner && <TabBar current={route.name} />}
    </MeContext.Provider>
  );
}
