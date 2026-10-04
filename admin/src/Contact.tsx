import { useState } from 'react';
import { contactLink } from './format';
import { haptic, openTg } from './tg';
import { Icon } from './ui';

/** Контакт: нажатие открывает чат, набор номера или письмо; рядом — скопировать. */
export function Contact({ value }: { value: string }) {
  const link = contactLink(value);
  const [copied, setCopied] = useState(false);
  const hint = { tg: 'Написать в Telegram', phone: 'Позвонить', mail: 'Написать письмо', text: 'Контакт' }[link.kind];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.label);
      setCopied(true);
      haptic.tap();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // буфер недоступен — текст контакта и так на экране, его можно выделить
    }
  };

  const main = (
    <span className="row__main">
      <span className="contact__value">{link.label}</span>
      <span className="row__meta">{hint}</span>
    </span>
  );

  return (
    <div className="contact">
      {link.kind === 'tg' ? (
        <button type="button" className="row contact__open" onClick={() => openTg(link.href!)}>
          {main}
        </button>
      ) : link.href ? (
        <a className="row contact__open" href={link.href}>
          {main}
        </a>
      ) : (
        <div className="row contact__open">{main}</div>
      )}
      <button type="button" className="iconbtn contact__copy" onClick={copy} aria-label={copied ? 'Скопировано' : 'Скопировать контакт'}>
        <Icon name={copied ? 'check' : 'copy'} />
      </button>
      <span className="sr" role="status">
        {copied ? 'Контакт скопирован' : ''}
      </span>
    </div>
  );
}
