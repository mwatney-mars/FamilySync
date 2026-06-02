import React from 'react';
import { 
  Sparkles, 
  Timer, 
  CloudRain, 
  Waves, 
  Droplets, 
  Moon, 
  Wind, 
  Radio, 
  Car, 
  Cpu, 
  Flame, 
  RotateCcw, 
  Music 
} from 'lucide-react';

const ZEN_TRANSLATIONS: Record<string, Record<string, string>> = {
  pt: {
    zenTitle: "Espaço Zen",
    zenSubtitle: "Sons relaxantes e ruído branco",
    sleepTimer: "Temporizador",
    timerOff: "Desativado",
    timerRemaining: "restante",
    volume: "Volume",
    playing: "Reproduzindo",
    rain: "Chuva",
    ocean: "Oceano",
    stream: "Riacho",
    night: "Noite na Floresta",
    fan: "Ventilador",
    noise: "Ruído Branco",
    car: "Interior de Carro",
    engine: "Motor Suave",
    hairdryer: "Secador de Cabelo",
    vacuumcleaner: "Aspirador de Pó",
    washingmachine: "Máquina de Lavar",
    train: "Viagem de Trem"
  },
  en: {
    zenTitle: "Zen Space",
    zenSubtitle: "Relaxing sounds & white noise",
    sleepTimer: "Sleep Timer",
    timerOff: "Off",
    timerRemaining: "remaining",
    volume: "Volume",
    playing: "Playing",
    rain: "Rain",
    ocean: "Ocean Waves",
    stream: "Running Stream",
    night: "Forest Night",
    fan: "Fan Hum",
    noise: "White Noise",
    car: "Car Interior",
    engine: "Engine Hum",
    hairdryer: "Hairdryer",
    vacuumcleaner: "Vacuum Cleaner",
    washingmachine: "Washing Machine",
    train: "Train Ride"
  },
  es: {
    zenTitle: "Espacio Zen",
    zenSubtitle: "Sonidos relajantes y ruido blanco",
    sleepTimer: "Temporizador",
    timerOff: "Apagado",
    timerRemaining: "restante",
    volume: "Volumen",
    playing: "Reproduciendo",
    rain: "Lluvia",
    ocean: "Océano",
    stream: "Arroyo",
    night: "Noche en el Bosque",
    fan: "Ventilador",
    noise: "Ruido Blanco",
    car: "Interior de Coche",
    engine: "Motor Suave",
    hairdryer: "Secador de Pelo",
    vacuumcleaner: "Aspiradora",
    washingmachine: "Lavadora",
    train: "Viaje en Tren"
  },
  pl: {
    zenTitle: "Strefa Zen",
    zenSubtitle: "Relaksujące dźwięki i biały szum",
    sleepTimer: "Wyłącznik czasowy",
    timerOff: "Wył.",
    timerRemaining: "pozostało",
    volume: "Głośność",
    playing: "Odtwarzanie",
    rain: "Deszcz",
    ocean: "Ocean",
    stream: "Strumyk",
    night: "Leśna Noc",
    fan: "Wentylator",
    noise: "Biały Szum",
    car: "Wnętrze Samochodu",
    engine: "Szum Silnika",
    hairdryer: "Suszarka do Włosów",
    vacuumcleaner: "Odkurzacz",
    washingmachine: "Pralka",
    train: "Podróż Pociągiem"
  },
  de: {
    zenTitle: "Zen-Bereich",
    zenSubtitle: "Entspannende Geräusche & weißes Rauschen",
    sleepTimer: "Sleep-Timer",
    timerOff: "Aus",
    timerRemaining: "verbleibend",
    volume: "Lautstärke",
    playing: "Wird abgespielt",
    rain: "Regen",
    ocean: "Ozean",
    stream: "Bachlauf",
    night: "Waldnacht",
    fan: "Ventilator",
    noise: "Weißes Rauschen",
    car: "Auto-Innenraum",
    engine: "Motorbrummen",
    hairdryer: "Haartrockner",
    vacuumcleaner: "Staubsauger",
    washingmachine: "Waschmaschine",
    train: "Zugfahrt"
  },
  fr: {
    zenTitle: "Espace Zen",
    zenSubtitle: "Sons relaxants & bruit blanc",
    sleepTimer: "Minuteur",
    timerOff: "Désactivé",
    timerRemaining: "restant",
    volume: "Volume",
    playing: "Lecture",
    rain: "Pluie",
    ocean: "Océan",
    stream: "Ruisseau",
    night: "Nuit en Forêt",
    fan: "Ventilateur",
    noise: "Bruit Blanc",
    car: "Intérieur de Voiture",
    engine: "Moteur Doux",
    hairdryer: "Sèche-cheveux",
    vacuumcleaner: "Aspirateur",
    washingmachine: "Machine à Laver",
    train: "Voyage en Train"
  },
  it: {
    zenTitle: "Spazio Zen",
    zenSubtitle: "Suoni rilassanti e rumore bianco",
    sleepTimer: "Timer autospegnimento",
    timerOff: "Spento",
    timerRemaining: "rimanente",
    volume: "Volume",
    playing: "In riproduzione",
    rain: "Pioggia",
    ocean: "Oceano",
    stream: "Ruscello",
    night: "Notte nei Boschi",
    fan: "Ventilatore",
    noise: "Rumore Bianco",
    car: "Interno Auto",
    engine: "Ronzio Motore",
    hairdryer: "Asciugacapelli",
    vacuumcleaner: "Aspirapolvere",
    washingmachine: "Lavatrice",
    train: "Viaggio in Treno"
  }
};

const SOUNDS_LIST = [
  { id: 'rain', icon: 'CloudRain', color: '#60a5fa', activeBg: 'rgba(96, 165, 250, 0.12)', glow: 'rgba(96, 165, 250, 0.25)' },
  { id: 'ocean', icon: 'Waves', color: '#3b82f6', activeBg: 'rgba(59, 130, 246, 0.12)', glow: 'rgba(59, 130, 246, 0.25)' },
  { id: 'stream', icon: 'Droplets', color: '#2563eb', activeBg: 'rgba(37, 99, 235, 0.12)', glow: 'rgba(37, 99, 235, 0.25)' },
  { id: 'night', icon: 'Moon', color: '#a78bfa', activeBg: 'rgba(167, 139, 250, 0.12)', glow: 'rgba(167, 139, 250, 0.25)' },
  { id: 'fan', icon: 'Wind', color: '#2dd4bf', activeBg: 'rgba(45, 212, 191, 0.12)', glow: 'rgba(45, 212, 191, 0.25)' },
  { id: 'noise', icon: 'Radio', color: '#c084fc', activeBg: 'rgba(192, 132, 252, 0.12)', glow: 'rgba(192, 132, 252, 0.25)' },
  { id: 'car', icon: 'Car', color: '#fbbf24', activeBg: 'rgba(251, 191, 36, 0.12)', glow: 'rgba(251, 191, 36, 0.25)' },
  { id: 'engine', icon: 'Cpu', color: '#f472b6', activeBg: 'rgba(244, 114, 182, 0.12)', glow: 'rgba(244, 114, 182, 0.25)' },
  { id: 'hairdryer', icon: 'Flame', color: '#f87171', activeBg: 'rgba(248, 113, 113, 0.12)', glow: 'rgba(248, 113, 113, 0.25)' },
  { id: 'vacuumcleaner', icon: 'Wind', color: '#94a3b8', activeBg: 'rgba(148, 163, 184, 0.12)', glow: 'rgba(148, 163, 184, 0.25)' },
  { id: 'washingmachine', icon: 'RotateCcw', color: '#22d3ee', activeBg: 'rgba(34, 211, 238, 0.12)', glow: 'rgba(34, 211, 238, 0.25)' },
  { id: 'train', icon: 'RotateCcw', color: '#34d399', activeBg: 'rgba(52, 211, 153, 0.12)', glow: 'rgba(52, 211, 153, 0.25)' }
];

interface ZenSpacePanelProps {
  language: string;
  activeSound: string | null;
  setActiveSound: (sound: string | null) => void;
  timerSeconds: number | null;
  setTimerSeconds: (seconds: number | null) => void;
  isFridge?: boolean;
}

export function ZenSpacePanel({
  language,
  activeSound,
  setActiveSound,
  timerSeconds,
  setTimerSeconds,
  isFridge = false
}: ZenSpacePanelProps) {
  
  const zt = (key: string): string => {
    return ZEN_TRANSLATIONS[language]?.[key] || ZEN_TRANSLATIONS['en']?.[key] || key;
  };

  const renderSoundIcon = (iconName: string, size = 18, style = {}) => {
    switch (iconName) {
      case 'CloudRain': return <CloudRain size={size} style={style} />;
      case 'Waves': return <Waves size={size} style={style} />;
      case 'Droplets': return <Droplets size={size} style={style} />;
      case 'Moon': return <Moon size={size} style={style} />;
      case 'Wind': return <Wind size={size} style={style} />;
      case 'Radio': return <Radio size={size} style={style} />;
      case 'Car': return <Car size={size} style={style} />;
      case 'Cpu': return <Cpu size={size} style={style} />;
      case 'Flame': return <Flame size={size} style={style} />;
      case 'RotateCcw': return <RotateCcw size={size} style={style} />;
      default: return <Music size={size} style={style} />;
    }
  };

  return (
    <div 
      className="glass-panel animate-scale-up" 
      style={{ 
        padding: isFridge ? '24px' : '20px 24px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        background: activeSound 
          ? `radial-gradient(circle at top right, ${SOUNDS_LIST.find(s => s.id === activeSound)?.activeBg || 'rgba(139, 92, 246, 0.05)'}, transparent 65%), var(--bg-glass)` 
          : 'var(--bg-glass)'
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: activeSound 
                ? `${SOUNDS_LIST.find(s => s.id === activeSound)?.color}15` 
                : 'rgba(255,255,255,0.03)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: activeSound 
                ? SOUNDS_LIST.find(s => s.id === activeSound)?.color 
                : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: activeSound 
                ? `${SOUNDS_LIST.find(s => s.id === activeSound)?.color}30` 
                : 'var(--border-light)',
              boxShadow: activeSound 
                ? `0 0 10px ${SOUNDS_LIST.find(s => s.id === activeSound)?.color}15` 
                : 'none',
              transition: 'all 0.3s'
            }}
            className={activeSound ? 'animate-pulse' : ''}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {zt('zenTitle')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '2px 0 0 0' }}>
              {zt('zenSubtitle')}
            </p>
          </div>
        </div>

        {/* EQUALIZER/STATUS */}
        {activeSound ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: SOUNDS_LIST.find(s => s.id === activeSound)?.color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {zt('playing')}
            </span>
            <div className="zen-wave-container">
              <div className="zen-wave-bar" style={{ backgroundColor: SOUNDS_LIST.find(s => s.id === activeSound)?.color }}></div>
              <div className="zen-wave-bar" style={{ backgroundColor: SOUNDS_LIST.find(s => s.id === activeSound)?.color }}></div>
              <div className="zen-wave-bar" style={{ backgroundColor: SOUNDS_LIST.find(s => s.id === activeSound)?.color }}></div>
              <div className="zen-wave-bar" style={{ backgroundColor: SOUNDS_LIST.find(s => s.id === activeSound)?.color }}></div>
            </div>
          </div>
        ) : null}
      </div>

      {/* SOUND SELECTION GRID */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '10px',
          margin: '4px 0'
        }}
      >
        {SOUNDS_LIST.map((sound) => {
          const isSelected = activeSound === sound.id;
          return (
            <div
              key={sound.id}
              onClick={() => {
                if (isSelected) {
                  setActiveSound(null);
                } else {
                  setActiveSound(sound.id);
                }
              }}
              className={`zen-sound-card ${isSelected ? 'active-custom' : ''}`}
              style={{
                '--active-bg': sound.activeBg,
                '--active-color': sound.color,
                '--active-glow': sound.glow,
                borderColor: isSelected ? sound.color : undefined
              } as React.CSSProperties}
              title={zt(sound.id)}
            >
              <div 
                className="zen-icon-wrapper" 
                style={{ 
                  color: isSelected ? sound.color : 'var(--text-secondary)',
                  transition: 'color 0.2s'
                }}
              >
                {renderSoundIcon(sound.icon, 20)}
              </div>
              <span 
                style={{ 
                  fontSize: '10px', 
                  fontWeight: isSelected ? '700' : '500', 
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s'
                }}
              >
                {zt(sound.id)}
              </span>
            </div>
          );
        })}
      </div>

      {/* CONTROLS (SLEEP TIMER ONLY) */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          borderTop: '1px solid var(--border-light)', 
          paddingTop: '14px',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        {/* TIMER CONTROL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Timer size={16} style={{ color: activeSound ? SOUNDS_LIST.find(s => s.id === activeSound)?.color : 'var(--text-secondary)' }} />
            {timerSeconds !== null ? (
              <span style={{ fontSize: '11px', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                {(() => {
                  const h = Math.floor(timerSeconds / 3600);
                  const m = Math.floor((timerSeconds % 3600) / 60);
                  const s = timerSeconds % 60;
                  return h > 0 
                    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                    : `${m}:${String(s).padStart(2, '0')}`;
                })()}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {zt('sleepTimer')}
              </span>
            )}
          </div>
          <select
            value={timerSeconds === null ? 'off' : timerSeconds}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'off') {
                setTimerSeconds(null);
              } else {
                setTimerSeconds(parseInt(val, 10));
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '11px',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="off" style={{ background: 'var(--bg-panels)' }}>{zt('timerOff')}</option>
            <option value="900" style={{ background: 'var(--bg-panels)' }}>15 Min</option>
            <option value="1800" style={{ background: 'var(--bg-panels)' }}>30 Min</option>
            <option value="2700" style={{ background: 'var(--bg-panels)' }}>45 Min</option>
            <option value="3600" style={{ background: 'var(--bg-panels)' }}>1 Hour</option>
            <option value="7200" style={{ background: 'var(--bg-panels)' }}>2 Hours</option>
            <option value="14400" style={{ background: 'var(--bg-panels)' }}>4 Hours</option>
            <option value="28800" style={{ background: 'var(--bg-panels)' }}>8 Hours</option>
          </select>
        </div>
      </div>
    </div>
  );
}
