import { useState, useEffect } from 'react';
import { Sun, CloudRain, Moon } from 'lucide-react';

const LOCALE_MAP: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  pl: 'pl-PL',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT'
};

interface LiveClockProps {
  language: string;
  isFridge?: boolean;
}

export function LiveClock({ language, isFridge = false }: LiveClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const locale = LOCALE_MAP[language] || 'en-US';

  if (isFridge) {
    return (
      <span>
        {time.toLocaleTimeString(locale)}
      </span>
    );
  }

  return (
    <>
      {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </>
  );
}

interface LiveDateProps {
  language: string;
  getLocalizedDate: (d: Date, lang: string) => string;
}

export function LiveDate({ language, getLocalizedDate }: LiveDateProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {getLocalizedDate(time, language)}
    </>
  );
}

interface LiveGreetingProps {
  t: (key: string) => string;
  withIcon?: boolean;
  userName?: string;
}

export function LiveGreeting({ t, withIcon = false, userName }: LiveGreetingProps) {
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const timer = setInterval(() => {
      setHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreetingText = () => {
    let text = '';
    if (hour >= 5 && hour < 12) {
      text = t('greetingMorning');
    } else if (hour >= 12 && hour < 18) {
      text = t('greetingAfternoon');
    } else {
      text = t('greetingEvening');
    }

    if (userName) {
      text = text
        .replace(/Família!/i, userName + '!')
        .replace(/Family!/i, userName + '!')
        .replace(/Familia!/i, userName + '!')
        .replace(/Rodzino!/i, userName + '!')
        .replace(/Familie!/i, userName + '!')
        .replace(/la famille !/i, userName + ' !')
        .replace(/Famiglia!/i, userName + '!');
    }

    return withIcon ? (hour >= 5 && hour < 12 ? '🌅 ' : hour >= 12 && hour < 18 ? '☀️ ' : '🌙 ') + text : text;
  };

  return <>{getGreetingText()}</>;
}

interface LiveWeatherProps {
  t: (key: string) => string;
  minimal?: boolean;
}

export function LiveWeather({ t, minimal = false }: LiveWeatherProps) {
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const timer = setInterval(() => {
      setHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getWeatherInfo = () => {
    if (hour >= 6 && hour < 12) {
      return {
        temp: '22°C',
        desc: t('weatherMorning'),
        icon: <Sun className="animate-pulse" size={24} style={{ color: 'var(--accent-warning)' }} />,
        glow: 'rgba(245, 158, 11, 0.15)'
      };
    } else if (hour >= 12 && hour < 18) {
      return {
        temp: '28°C',
        desc: t('weatherAfternoon') || 'Tarde Ensolarada',
        icon: <Sun size={24} style={{ color: 'var(--accent-warning)', animation: 'spin 20s linear infinite' }} />,
        glow: 'rgba(245, 158, 11, 0.25)'
      };
    } else if (hour >= 18 && hour < 22) {
      return {
        temp: '19°C',
        desc: t('weatherEvening') || 'Noite Estrelada',
        icon: <Moon size={24} style={{ color: 'var(--accent-violet)' }} />,
        glow: 'rgba(139, 92, 246, 0.15)'
      };
    } else {
      return {
        temp: '16°C',
        desc: t('weatherNight') || 'Céu Limpo',
        icon: <CloudRain size={24} style={{ color: 'var(--accent-info)' }} />,
        glow: 'rgba(14, 165, 233, 0.15)'
      };
    }
  };

  const info = getWeatherInfo();

  if (minimal) {
    return (
      <div 
        className="animate-fade-in" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {info.icon}
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2' }}>{info.temp}</div>
            <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)' }}>{info.desc}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="glass-panel animate-fade-in" 
      style={{ 
        padding: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        background: `radial-gradient(circle at top right, ${info.glow}, transparent)` 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {info.icon}
        </div>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Clima Local</div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{info.desc}</div>
        </div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>{info.temp}</div>
    </div>
  );
}
